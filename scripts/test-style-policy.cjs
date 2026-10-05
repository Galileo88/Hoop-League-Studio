const {test}=require('node:test');
const assert=require('node:assert/strict');
const {repair,allowed}=require('../assets/js/style-policy.js');
const player=(gender,id)=>({id,gender,age:24,yrs:5,attributes:{LAY:[12,14]},appearance:{hair:'9999',hairC:'123456',fHair:'0031'},accessories:[{headAcc:'0007',headAcc2:'0012',headAccC:'PRI',shoeC:'FFFFFF'}],suits:[{headAcc:'0007'}],stats:[{yr:2000}],awards:[{id:2,yearsWon:[2000]}]});

test('optional cleanup respects gender pools, approved gear, and all non-style data',()=>{
 const male=player(0,10),female=player(1,11),approved=player(0,12);
 approved.appearance.hair=allowed.hair.male[0];approved.accessories=[{headAcc:'0001',headAcc2:'none'}];approved.suits=[];
 const staff={id:13,gender:0,attributes:{development:[10,10]},appearance:{hair:'9999'}};
 const league={teams:[{roster:[male,female,approved],frontOffice:{staff:[staff]}}],starTeams:[{roster:[structuredClone(male)]}],freeAgents:[player(1,14)]};
 const before=structuredClone(league),result=repair(league);
 assert.equal(result.hairstyles,4);assert.equal(result.accessories,12);
 assert.ok(allowed.hair.male.includes(male.appearance.hair));assert.ok(allowed.hair.female.includes(female.appearance.hair));
 assert.equal(male.appearance.hair,league.starTeams[0].roster[0].appearance.hair);
 assert.deepEqual(approved,before.teams[0].roster[2]);assert.deepEqual(staff,before.teams[0].frontOffice.staff[0]);
 // Restore only the permitted fields, then compare the entire league.
 for(const [after,original] of [[male,before.teams[0].roster[0]],[female,before.teams[0].roster[1]],[league.starTeams[0].roster[0],before.starTeams[0].roster[0]],[league.freeAgents[0],before.freeAgents[0]]]){
  const copy=structuredClone(after);copy.appearance.hair=original.appearance.hair;
  assert.equal(copy.accessories[0].headAcc,'none');assert.equal(copy.accessories[0].headAcc2,'0000');assert.equal(copy.suits[0].headAcc,'none');
  copy.accessories[0].headAcc=original.accessories[0].headAcc;copy.accessories[0].headAcc2=original.accessories[0].headAcc2;copy.suits[0].headAcc=original.suits[0].headAcc;
  assert.deepEqual(copy,original);
 }
 assert.deepEqual(repair(league),{players:0,hairstyles:0,accessories:0});
});

test('blank accessories and unknown genders are preserved',()=>{
 const p=player(0,1);p.appearance.hair=allowed.hair.male[0];p.accessories=[{headAcc:'none',headAcc2:'0000'},{headAcc:'',headAcc2:null}];p.suits=[];
 const unknown=player(2,2),league={freeAgents:[p,unknown]},before=structuredClone(league);
 assert.deepEqual(repair(league),{players:0,hairstyles:0,accessories:0});assert.deepEqual(league,before);
});
