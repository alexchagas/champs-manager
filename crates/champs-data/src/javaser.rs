//! Minimal, dependency-free reader for the Java Object Serialization Stream
//! Protocol (`ObjectOutputStream`), sufficient for Brasfoot `.ban`, `.cfg`
//! and `.ces` files. Objects are decoded generically into [`Value`] trees.

use std::collections::HashMap;
use std::rc::Rc;

use crate::error::DataError;

const MAGIC: u16 = 0xACED;
const VERSION: u16 = 5;
const BASE_HANDLE: usize = 0x7E0000;

const TC_NULL: u8 = 0x70;
const TC_REFERENCE: u8 = 0x71;
const TC_CLASSDESC: u8 = 0x72;
const TC_OBJECT: u8 = 0x73;
const TC_STRING: u8 = 0x74;
const TC_ARRAY: u8 = 0x75;
const TC_CLASS: u8 = 0x76;
const TC_BLOCKDATA: u8 = 0x77;
const TC_ENDBLOCKDATA: u8 = 0x78;
const TC_RESET: u8 = 0x79;
const TC_BLOCKDATALONG: u8 = 0x7A;
const TC_LONGSTRING: u8 = 0x7C;
const TC_PROXYCLASSDESC: u8 = 0x7D;
const TC_ENUM: u8 = 0x7E;

const SC_WRITE_METHOD: u8 = 0x01;
const SC_EXTERNALIZABLE: u8 = 0x04;

/// A decoded Java value.
#[derive(Debug, Clone)]
pub enum Value {
    Null,
    Bool(bool),
    Byte(i8),
    Char(u16),
    Short(i16),
    Int(i32),
    Long(i64),
    Float(f32),
    Double(f64),
    Str(Rc<str>),
    Object(Rc<Object>),
    Array(Rc<Vec<Value>>),
    /// Raw block-data bytes found in custom `writeObject` annotations.
    Block(Rc<Vec<u8>>),
    /// A class literal or enum constant (by name).
    Named(Rc<str>),
}

/// A decoded Java object: flattened fields across the class hierarchy plus
/// custom-serialization annotations (e.g. `ArrayList` elements).
#[derive(Debug)]
pub struct Object {
    pub class: String,
    pub fields: Vec<(String, Value)>,
    pub annotations: Vec<Value>,
}

impl Object {
    pub fn get(&self, name: &str) -> Option<&Value> {
        self.fields.iter().find(|(n, _)| n == name).map(|(_, v)| v)
    }
    pub fn int(&self, name: &str) -> i32 {
        match self.get(name) {
            Some(Value::Int(v)) => *v,
            Some(Value::Short(v)) => *v as i32,
            Some(Value::Byte(v)) => *v as i32,
            _ => 0,
        }
    }
    pub fn boolean(&self, name: &str) -> bool {
        matches!(self.get(name), Some(Value::Bool(true)))
    }
    pub fn string(&self, name: &str) -> String {
        match self.get(name) {
            Some(Value::Str(s)) => s.to_string(),
            _ => String::new(),
        }
    }
    pub fn object(&self, name: &str) -> Option<&Rc<Object>> {
        match self.get(name) {
            Some(Value::Object(o)) => Some(o),
            _ => None,
        }
    }
    /// Elements of a `java.util.ArrayList`-style collection (objects found in
    /// the custom annotation section).
    pub fn list_items(&self) -> Vec<&Value> {
        self.annotations
            .iter()
            .filter(|v| !matches!(v, Value::Block(_)))
            .collect()
    }
}

#[derive(Debug)]
struct FieldDesc {
    type_code: u8,
    name: String,
}

#[derive(Debug)]
struct ClassDesc {
    name: String,
    flags: u8,
    fields: Vec<FieldDesc>,
    superclass: Option<Rc<ClassDesc>>,
}

enum Handle {
    Class(Option<Rc<ClassDesc>>),
    Value(Value),
    Pending,
}

struct Reader<'a> {
    buf: &'a [u8],
    pos: usize,
    handles: Vec<Handle>,
}

type Res<T> = Result<T, DataError>;

impl<'a> Reader<'a> {
    fn err<T>(&self, msg: impl Into<String>) -> Res<T> {
        Err(DataError::Serialization {
            offset: self.pos,
            message: msg.into(),
        })
    }

    fn take(&mut self, n: usize) -> Res<&'a [u8]> {
        if self.pos + n > self.buf.len() {
            return self.err("unexpected end of stream");
        }
        let s = &self.buf[self.pos..self.pos + n];
        self.pos += n;
        Ok(s)
    }
    fn u8(&mut self) -> Res<u8> {
        Ok(self.take(1)?[0])
    }
    fn peek(&self) -> Res<u8> {
        self.buf
            .get(self.pos)
            .copied()
            .ok_or(DataError::Serialization {
                offset: self.pos,
                message: "unexpected end of stream".into(),
            })
    }
    fn u16(&mut self) -> Res<u16> {
        Ok(u16::from_be_bytes(self.take(2)?.try_into().unwrap()))
    }
    fn i32(&mut self) -> Res<i32> {
        Ok(i32::from_be_bytes(self.take(4)?.try_into().unwrap()))
    }
    fn i64(&mut self) -> Res<i64> {
        Ok(i64::from_be_bytes(self.take(8)?.try_into().unwrap()))
    }

    fn utf(&mut self) -> Res<String> {
        let n = self.u16()? as usize;
        Ok(decode_mutf8(self.take(n)?))
    }
    fn long_utf(&mut self) -> Res<String> {
        let n = self.i64()? as usize;
        Ok(decode_mutf8(self.take(n)?))
    }

    fn new_handle(&mut self, h: Handle) -> usize {
        self.handles.push(h);
        self.handles.len() - 1
    }

    fn read_class_desc(&mut self) -> Res<Option<Rc<ClassDesc>>> {
        let tc = self.u8()?;
        match tc {
            TC_NULL => Ok(None),
            TC_REFERENCE => {
                let idx = self.reference_index()?;
                match self.handles.get(idx) {
                    Some(Handle::Class(c)) => Ok(c.clone()),
                    _ => self.err("reference is not a class descriptor"),
                }
            }
            TC_CLASSDESC => {
                let name = self.utf()?;
                let _suid = self.i64()?;
                let slot = self.new_handle(Handle::Pending);
                let flags = self.u8()?;
                let n = self.u16()? as usize;
                let mut fields = Vec::with_capacity(n);
                for _ in 0..n {
                    let type_code = self.u8()?;
                    let fname = self.utf()?;
                    if type_code == b'L' || type_code == b'[' {
                        // field type string (may be a back-reference)
                        self.read_content()?;
                    }
                    fields.push(FieldDesc {
                        type_code,
                        name: fname,
                    });
                }
                self.skip_annotations()?;
                let superclass = self.read_class_desc()?;
                let desc = Rc::new(ClassDesc {
                    name,
                    flags,
                    fields,
                    superclass,
                });
                self.handles[slot] = Handle::Class(Some(desc.clone()));
                Ok(Some(desc))
            }
            TC_PROXYCLASSDESC => {
                let slot = self.new_handle(Handle::Pending);
                let n = self.i32()?;
                for _ in 0..n {
                    self.utf()?;
                }
                self.skip_annotations()?;
                let superclass = self.read_class_desc()?;
                let desc = Rc::new(ClassDesc {
                    name: "<proxy>".into(),
                    flags: 0,
                    fields: vec![],
                    superclass,
                });
                self.handles[slot] = Handle::Class(Some(desc.clone()));
                Ok(Some(desc))
            }
            other => self.err(format!("unexpected class descriptor tag 0x{other:02x}")),
        }
    }

    fn reference_index(&mut self) -> Res<usize> {
        let h = self.i32()? as usize;
        if h < BASE_HANDLE || h - BASE_HANDLE >= self.handles.len() {
            return self.err(format!("invalid handle 0x{h:x}"));
        }
        Ok(h - BASE_HANDLE)
    }

    fn skip_annotations(&mut self) -> Res<()> {
        loop {
            if self.peek()? == TC_ENDBLOCKDATA {
                self.pos += 1;
                return Ok(());
            }
            self.read_content()?;
        }
    }

    fn read_annotations(&mut self) -> Res<Vec<Value>> {
        let mut out = Vec::new();
        loop {
            if self.peek()? == TC_ENDBLOCKDATA {
                self.pos += 1;
                return Ok(out);
            }
            out.push(self.read_content()?);
        }
    }

    fn read_field_value(&mut self, code: u8) -> Res<Value> {
        Ok(match code {
            b'B' => Value::Byte(self.u8()? as i8),
            b'C' => Value::Char(self.u16()?),
            b'D' => Value::Double(f64::from_bits(self.i64()? as u64)),
            b'F' => Value::Float(f32::from_bits(self.i32()? as u32)),
            b'I' => Value::Int(self.i32()?),
            b'J' => Value::Long(self.i64()?),
            b'S' => Value::Short(self.u16()? as i16),
            b'Z' => Value::Bool(self.u8()? != 0),
            b'L' | b'[' => self.read_content()?,
            other => return self.err(format!("unknown field type '{}'", other as char)),
        })
    }

    /// Reads class data for a descriptor chain, superclass-first.
    fn read_class_data(
        &mut self,
        desc: &Rc<ClassDesc>,
        fields: &mut Vec<(String, Value)>,
        annotations: &mut Vec<Value>,
    ) -> Res<()> {
        if let Some(sup) = &desc.superclass {
            self.read_class_data(sup, fields, annotations)?;
        }
        if desc.flags & SC_EXTERNALIZABLE != 0 {
            return self.err(format!(
                "externalizable class {} is not supported",
                desc.name
            ));
        }
        for f in &desc.fields {
            let v = self.read_field_value(f.type_code)?;
            fields.push((f.name.clone(), v));
        }
        if desc.flags & SC_WRITE_METHOD != 0 {
            annotations.extend(self.read_annotations()?);
        }
        Ok(())
    }

    fn read_content(&mut self) -> Res<Value> {
        let tc = self.u8()?;
        match tc {
            TC_NULL => Ok(Value::Null),
            TC_REFERENCE => {
                let idx = self.reference_index()?;
                match &self.handles[idx] {
                    Handle::Value(v) => Ok(v.clone()),
                    Handle::Class(Some(c)) => Ok(Value::Named(c.name.as_str().into())),
                    _ => self.err("reference to unresolved object (cyclic graph)"),
                }
            }
            TC_STRING => {
                let s: Rc<str> = self.utf()?.into();
                self.new_handle(Handle::Value(Value::Str(s.clone())));
                Ok(Value::Str(s))
            }
            TC_LONGSTRING => {
                let s: Rc<str> = self.long_utf()?.into();
                self.new_handle(Handle::Value(Value::Str(s.clone())));
                Ok(Value::Str(s))
            }
            TC_OBJECT => {
                let desc = self.read_class_desc()?.ok_or(DataError::Serialization {
                    offset: self.pos,
                    message: "object without class descriptor".into(),
                })?;
                let slot = self.new_handle(Handle::Pending);
                let mut fields = Vec::new();
                let mut annotations = Vec::new();
                self.read_class_data(&desc, &mut fields, &mut annotations)?;
                let v = Value::Object(Rc::new(Object {
                    class: desc.name.clone(),
                    fields,
                    annotations,
                }));
                self.handles[slot] = Handle::Value(v.clone());
                Ok(v)
            }
            TC_ARRAY => {
                let desc = self.read_class_desc()?.ok_or(DataError::Serialization {
                    offset: self.pos,
                    message: "array without class descriptor".into(),
                })?;
                let slot = self.new_handle(Handle::Pending);
                let len = self.i32()?;
                if len < 0 {
                    return self.err("negative array length");
                }
                let elem = desc.name.as_bytes().get(1).copied().unwrap_or(b'L');
                let mut items = Vec::with_capacity((len as usize).min(1 << 16));
                for _ in 0..len {
                    items.push(self.read_field_value(elem)?);
                }
                let v = Value::Array(Rc::new(items));
                self.handles[slot] = Handle::Value(v.clone());
                Ok(v)
            }
            TC_CLASS => {
                let desc = self.read_class_desc()?;
                let name: Rc<str> = desc.map(|d| d.name.clone()).unwrap_or_default().into();
                let v = Value::Named(name);
                self.new_handle(Handle::Value(v.clone()));
                Ok(v)
            }
            TC_ENUM => {
                self.read_class_desc()?;
                let slot = self.new_handle(Handle::Pending);
                let name = self.read_content()?;
                let v = match name {
                    Value::Str(s) => Value::Named(s),
                    _ => return self.err("enum constant name is not a string"),
                };
                self.handles[slot] = Handle::Value(v.clone());
                Ok(v)
            }
            TC_BLOCKDATA => {
                let n = self.u8()? as usize;
                Ok(Value::Block(Rc::new(self.take(n)?.to_vec())))
            }
            TC_BLOCKDATALONG => {
                let n = self.i32()? as usize;
                Ok(Value::Block(Rc::new(self.take(n)?.to_vec())))
            }
            TC_RESET => {
                self.handles.clear();
                self.read_content()
            }
            TC_CLASSDESC | TC_PROXYCLASSDESC => {
                self.pos -= 1;
                let d = self.read_class_desc()?;
                Ok(Value::Named(
                    d.map(|d| d.name.clone()).unwrap_or_default().into(),
                ))
            }
            other => self.err(format!("unexpected tag 0x{other:02x}")),
        }
    }
}

/// Decodes Java "modified UTF-8".
fn decode_mutf8(b: &[u8]) -> String {
    if let Ok(s) = std::str::from_utf8(b) {
        if !b.contains(&0xC0) && !b.contains(&0xED) {
            return s.to_string();
        }
    }
    let mut units: Vec<u16> = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        let c = b[i];
        if c < 0x80 {
            units.push(c as u16);
            i += 1;
        } else if c & 0xE0 == 0xC0 && i + 1 < b.len() {
            units.push((((c & 0x1F) as u16) << 6) | (b[i + 1] & 0x3F) as u16);
            i += 2;
        } else if c & 0xF0 == 0xE0 && i + 2 < b.len() {
            units.push(
                (((c & 0x0F) as u16) << 12)
                    | (((b[i + 1] & 0x3F) as u16) << 6)
                    | (b[i + 2] & 0x3F) as u16,
            );
            i += 3;
        } else {
            units.push(0xFFFD);
            i += 1;
        }
    }
    String::from_utf16_lossy(&units)
}

/// Parses a serialization stream and returns all top-level objects.
pub fn parse_stream(data: &[u8]) -> Result<Vec<Value>, DataError> {
    let mut r = Reader {
        buf: data,
        pos: 0,
        handles: Vec::new(),
    };
    if data.len() < 4 {
        return r.err("stream too short");
    }
    let magic = r.u16()?;
    let version = r.u16()?;
    if magic != MAGIC || version != VERSION {
        return r.err(format!("bad stream header {magic:04x}/{version}"));
    }
    let mut out = Vec::new();
    while r.pos < data.len() {
        out.push(r.read_content()?);
    }
    Ok(out)
}

/// Convenience: counts class names in a value tree (debugging aid).
pub fn class_histogram(v: &Value, out: &mut HashMap<String, usize>) {
    match v {
        Value::Object(o) => {
            *out.entry(o.class.clone()).or_default() += 1;
            for (_, f) in &o.fields {
                class_histogram(f, out);
            }
            for a in &o.annotations {
                class_histogram(a, out);
            }
        }
        Value::Array(a) => a.iter().for_each(|x| class_histogram(x, out)),
        _ => {}
    }
}
