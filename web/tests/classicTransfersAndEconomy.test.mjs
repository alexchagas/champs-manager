import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { 
  calculateRescissionPenalty, 
  generateRoundAuctions, 
  bidOnRoundAuctionItem, 
  concludeRoundAuctionItem, 
  runInstantPlayerAuction,
  evaluateContractRenewal,
  evaluatePlayerTransferAcceptance
} from '../src/engine/careerEconomy.ts';
import { generateInitialFreeAgents, createNewGame } from '../src/data/initialData.ts';

test('Free Agents pool: modest strength (32-44), veteran age, and realistic salaries (Brasfoot classic)', () => {
  const freeAgents = generateInitialFreeAgents();
  assert.ok(freeAgents.length >= 10, 'Generates at least 10 free agents');
  for (const player of freeAgents) {
    assert.ok(player.strength >= 32 && player.strength <= 44, `Player strength ${player.strength} is within modest range (32-44)`);
    assert.ok(player.age >= 27 && player.age <= 35, `Player age ${player.age} is veteran (27-35)`);
    assert.equal(player.isStar, false, 'Free agents are never stars');
    assert.equal(player.isWorldTop, false, 'Free agents are never world tops');
    assert.ok(player.salary <= 25_000, `Player salary ${player.salary} is realistic for free agent`);
  }
});

test('Rescission penalty: 15% to 35% deduction on sales with remaining contract years', () => {
  // Remaining contract years: 0 -> 0% penalty
  assert.equal(calculateRescissionPenalty(0, 1_000_000), 0);
  
  // Remaining contract: 1 year -> 15% penalty
  const pen1 = calculateRescissionPenalty(1, 1_000_000);
  assert.equal(pen1, 150_000);

  // Remaining contract: 2 years -> 25% penalty
  const pen2 = calculateRescissionPenalty(2, 1_000_000);
  assert.equal(pen2, 250_000);

  // Remaining contract: 3 years -> 35% penalty
  const pen3 = calculateRescissionPenalty(3, 1_000_000);
  assert.equal(pen3, 350_000);
});

test('Round auctions: generates 5 surplus players from CPU clubs with >= 21 players', () => {
  const state = createNewGame(255, 'Alex');
  // Add surplus players ONLY to other CPU clubs, leaving user squad intact
  const clubsWithSurplus = state.clubs.map((c, i) => c.id !== state.userClubId && i < 6 ? {
    ...c,
    squad: [
      ...c.squad,
      ...Array.from({ length: 6 }, (_, k) => ({
        id: 88000 + i * 10 + k,
        name: `Surplus ${i}-${k}`,
        age: 24,
        position: 'ATA',
        strength: 55,
        salary: 10000,
        marketValue: 500000,
        isStarter: false,
      }))
    ]
  } : c);

  const auctions = generateRoundAuctions(clubsWithSurplus, 1);
  assert.equal(auctions.length, 5, 'Generates exactly 5 round auction items');
  for (const item of auctions) {
    assert.ok(item.startingPrice > 0, 'Starting price is positive');
    assert.ok(item.currentBid >= item.startingPrice, 'Current bid matches or exceeds starting price');
    assert.ok(item.player, 'Contains player data');
  }
});

test('Round auctions: bidding and conclusion transfers player and updates balances', () => {
  const state = createNewGame(255, 'Alex');
  // Ensure user has a squad with < 30 players and CPU clubs have surplus
  const clubsWithSurplus = state.clubs.map((c, i) => {
    if (c.id === state.userClubId) {
      return { ...c, squad: c.squad.slice(0, 20), balance: 20_000_000 };
    }
    if (i < 6) {
      return {
        ...c,
        squad: [
          ...c.squad,
          ...Array.from({ length: 6 }, (_, k) => ({
            id: 89000 + i * 10 + k,
            name: `Surplus ${i}-${k}`,
            age: 24,
            position: 'ATA',
            strength: 55,
            salary: 10000,
            marketValue: 500000,
            isStarter: false,
          }))
        ]
      };
    }
    return c;
  });

  const auctions = generateRoundAuctions(clubsWithSurplus, 1);
  const auction = auctions[0];
  const user = clubsWithSurplus.find(c => c.id === state.userClubId);
  const userInitialBalance = user.balance;

  const bidAmount = auction.minNextBid + 50_000;
  const bidResult = bidOnRoundAuctionItem({ ...state, clubs: clubsWithSurplus, roundAuctions: auctions }, auction.id, bidAmount);
  assert.equal(bidResult.success, true);
  assert.equal(bidResult.newState.roundAuctions[0].highestBidderClubId, user.id);
  assert.equal(bidResult.newState.roundAuctions[0].currentBid, bidAmount);

  // Conclude auction
  const concludeResult = concludeRoundAuctionItem(bidResult.newState, auction.id);
  assert.equal(concludeResult.success, true);
  const userAfter = concludeResult.newState.clubs.find(c => c.id === user.id);
  assert.equal(userAfter.balance, userInitialBalance - bidAmount);
  assert.ok(userAfter.squad.some(p => p.id === auction.player.id), 'Winning player added to user squad');
});

test('Player transfer acceptance: lower division / foreign clubs cannot buy star without matching conditions', () => {
  const state = createNewGame(255, 'Alex');
  const palmeiras = state.clubs.find(c => c.name === 'Palmeiras') || state.clubs[0];
  const starPlayer = palmeiras.squad.slice().sort((a,b) => b.strength - a.strength)[0];

  // Low reputation buyer club trying to buy star player
  const smallClub = {
    id: 9999,
    name: 'Clube Modesto',
    reputation: 1,
    division: 4,
    countryId: 29,
  };

  // evaluatePlayerTransferAcceptance(buyer, seller, player)
  const evalResult = evaluatePlayerTransferAcceptance(smallClub, palmeiras, starPlayer);
  assert.equal(evalResult.accepted, false, 'Star player rejects joining low division/reputation club');
  assert.ok(evalResult.reason.length > 0);
});

test('Contract renewal: player counter-demands salary when offered insufficient wage', () => {
  const state = createNewGame(255, 'Alex');
  const user = state.clubs.find(c => c.id === state.userClubId);
  // Prepare a player with high salary and market value
  const player = { ...user.squad[0], salary: 50_000, marketValue: 2_000_000, contractYears: 1 };
  const clubsWithPlayer = state.clubs.map(c => c.id === user.id ? {
    ...c,
    squad: [player, ...c.squad.slice(1)]
  } : c);
  const stateWithPlayer = { ...state, clubs: clubsWithPlayer };

  // Offer tiny salary (e.g. 500/month)
  const renewResult = evaluateContractRenewal(stateWithPlayer, player.id, 3, 500);
  assert.equal(renewResult.success, false);
  assert.ok(renewResult.counterOffer > 500, 'Returns realistic counter-offer');

  // Accept counter-offer
  const acceptResult = evaluateContractRenewal(stateWithPlayer, player.id, 3, renewResult.counterOffer);
  assert.equal(acceptResult.success, true);
  const updatedUser = acceptResult.newState.clubs.find(c => c.id === user.id);
  const updatedPlayer = updatedUser.squad.find(p => p.id === player.id);
  assert.equal(updatedPlayer.salary, renewResult.counterOffer);
  assert.equal(updatedPlayer.contractYears, 3);
});

test('Instant player auction: AI clubs submit bids and player is sold with rescission penalty', () => {
  const state = createNewGame(255, 'Alex');
  // Enrich buyer clubs so they can all afford the player auction easily
  const richClubs = state.clubs.map(c => ({
    ...c,
    balance: 50_000_000,
    squad: c.squad.slice(0, 22),
  }));
  const richState = { ...state, clubs: richClubs };

  const user = richClubs.find(c => c.id === state.userClubId);
  const playerToAuction = { ...user.squad[user.squad.length - 1], marketValue: 500_000, contractYears: 2 };
  const userWithPlayer = {
    ...user,
    squad: [...user.squad.slice(0, -1), playerToAuction]
  };
  const finalState = {
    ...richState,
    clubs: richClubs.map(c => c.id === user.id ? userWithPlayer : c)
  };

  const startingBid = Math.round(playerToAuction.marketValue * 0.5);
  const auctionResult = runInstantPlayerAuction(finalState, playerToAuction.id, startingBid);
  assert.equal(auctionResult.sold, true, 'Player was sold in auction');
  assert.ok(auctionResult.finalBid > 0, 'Final bid is positive');
  assert.ok(auctionResult.penalty > 0, 'Penalty is deducted on contract with remaining years');
  assert.equal(auctionResult.netProceeds, auctionResult.finalBid - auctionResult.penalty);

  // Player no longer in user squad
  const userAfter = auctionResult.newState.clubs.find(c => c.id === user.id);
  assert.ok(!userAfter.squad.some(p => p.id === playerToAuction.id));
});

test('Contract renewal counter-offer returns valid number and does not produce NaN in UI state', () => {
  const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const transfersScreenPath = path.join(projectRoot, 'src/components/TransfersScreen.tsx');
  const content = fs.readFileSync(transfersScreenPath, 'utf-8');

  // Verify formatMoney handles undefined/NaN safely
  assert.ok(content.includes('typeof val === \'number\' && !isNaN(val)'), 'formatMoney must guard against undefined/NaN');

  // Verify counter-offer extraction extracts a number, not undefined
  assert.ok(content.includes('typeof res.counterOffer === \'number\''), 'handleConfirmRenew must check for number counterOffer');
  assert.ok(!content.includes('demanded: res.counterOffer.demandedSalary,'), 'Must not attempt property access on primitive counterOffer number');
});

