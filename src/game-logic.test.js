import test from 'node:test';
import assert from 'node:assert/strict';
import { speedAt, scoreFor, isOnRoof, hitsObstacle, GRAVITY, JUMP_SPEED, safeStored, safeSave } from './game-logic.js';
test('roof edges and gaps correspond to the moving world', () => {
 const roofs=[{z:0,length:18},{z:-21.5,length:18}];
 assert.equal(isOnRoof(roofs,0),true); assert.equal(isOnRoof(roofs,10.5),false); assert.equal(isOnRoof(roofs,14),true);
});
test('a jump clears the largest gap even at initial speed', () => {
 const flight=2*JUMP_SPEED/GRAVITY; assert.ok(flight*speedAt(0)>3.5+2); assert.ok(JUMP_SPEED**2/(2*GRAVITY)>1.35);
});
test('obstacles can be cleared by changing lanes or jumping',()=>{
 const o={x:0,z:0,height:1.3}; assert.equal(hitsObstacle(0,0,0,o),true);assert.equal(hitsObstacle(3.15,0,0,o),false);assert.equal(hitsObstacle(0,1.4,0,o),false);assert.equal(hitsObstacle(0,0,3,o),false);
});
test('speed caps and collectible score bonuses',()=>{assert.equal(speedAt(0),12);assert.equal(speedAt(1e6),24);assert.equal(scoreFor(100,3),350);});
test('storage errors do not prevent playing',()=>{const locked={getItem(){throw Error()},setItem(){throw Error()}};assert.equal(safeStored(locked,'best','0'),'0');assert.doesNotThrow(()=>safeSave(locked,'best',100));});
