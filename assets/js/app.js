(async()=>{
const standaloneSample=JSON.parse(window.__HLS_STANDALONE_SAMPLE.join(''));delete window.__HLS_STANDALONE_SAMPLE;
function archiveURL(value,assets){
  let u;try{u=new URL(value)}catch{return value}
  if(['www.dropbox.com','dropbox.com'].includes(u.hostname)&&/^\/(s|scl\/fi)\//.test(u.pathname)){
    u.searchParams.delete('dl');u.searchParams.set('raw','1');return u.href;
  }
  return value;
}
function imageDimensions(url){return new Promise((resolve,reject)=>{
 if(typeof url!=='string'||! /^(https?:|data:image\/|blob:)/i.test(url)){reject(Error('Choose an uploaded image or a public image URL.'));return}
  const image=new Image();const timer=setTimeout(()=>{image.onload=image.onerror=null;reject(Error('Image request timed out.'))},15000);
  image.onload=()=>{clearTimeout(timer);resolve({width:image.naturalWidth,height:image.naturalHeight})};
  image.onerror=()=>{clearTimeout(timer);reject(Error('Image could not be loaded. Check its public URL.'))};image.src=url;
})}
function validateImageSize(size,kind='logo'){
  const [maxWidth,maxHeight]=kind==='court'?[1024,1024]:[256,256];
  if(!Number.isInteger(size.width)||!Number.isInteger(size.height)||size.width<1||size.height<1)throw Error('Image has invalid dimensions.');
  if(size.width>maxWidth||size.height>maxHeight)throw Error(`${kind==='court'?'Court':'Logo'} is ${size.width} × ${size.height} pixels; maximum is ${maxWidth} × ${maxHeight}.`);
  return size;
}
function isCustomImage(value){return typeof value==='string'&&/^(?:https?:\/\/|data:image\/|blob:)/i.test(value.trim())}
function archiveAssetKey(value){
  const normalized=archiveURL(value,assets);
  try{
    const u=new URL(normalized);
    u.hash='';
    u.search='';
    const host=u.hostname.toLowerCase();
    if(host==='raw.githubusercontent.com'){
      const parts=u.pathname.split('/').filter(Boolean);
      if(parts.length>=4){
        const owner=parts[0].toLowerCase();
        const repo=parts[1].toLowerCase();
        const ref=parts[2];
        const path=parts.slice(3).map(decodeURIComponent).join('/');
        return 'github:'+owner+'/'+repo+'/'+ref+'/'+path;
      }
    }
    return host+u.pathname;
  }catch{
    return String(normalized??'').split('#')[0].split('?')[0];
  }
}
function findArchiveAsset(value,assets){
  const wanted=archiveAssetKey(value);
  return (assets||[]).find(asset=>
    [asset?.url,asset?.local].filter(Boolean).some(candidate=>archiveAssetKey(candidate)===wanted)
  )||null;
}
function exportLogoURL(value,assets){
  const normalized=archiveURL(value,assets);
  const asset=findArchiveAsset(normalized,assets);
  if(!asset?.local)return normalized;
  try{
    const u=new URL(asset.local);
    u.searchParams.delete('reset');
    return u.href;
  }catch{
    return asset.local;
  }
}
function exportCourtURL(value,assets){
  const normalized=archiveURL(value,assets);
  const asset=findArchiveAsset(normalized,assets);

  // Keep the live branch URL so repository image updates remain available.
  const fallback=asset?.url||normalized;
  try{
    const u=new URL(fallback);
    u.search='';
    u.hash='';
    return u.href;
  }catch{
    return String(fallback??'').split('#')[0].split('?')[0];
  }
}
function exportOtherImageURL(value,assets){
  const normalized=archiveURL(value,assets);
  const asset=findArchiveAsset(normalized,assets);
  if(!asset?.local)return normalized;
  try{
    const u=new URL(asset.local);
    u.searchParams.delete('reset');
    return u.href;
  }catch{
    return asset.local;
  }
}
async function prepareImages(data,assets,measure=imageDimensions){
  const result=window.HLSTournamentCourts.forExport(data,standaloneSample.teams[0].court),jobs=[];normalizeLexingtonLocations(result);
  const prepareLogo=(owner,name)=>{
    if(!isCustomImage(owner.logoURL))return;
    jobs.push((async()=>{
      owner.logoURL=exportLogoURL(owner.logoURL,assets);
      try{
        validateImageSize(await measure(owner.logoURL));
        if(!Number.isInteger(owner.logoSize)||owner.logoSize<0||owner.logoSize>4)owner.logoSize=0;
      }catch(e){throw Error(name+' logo: '+e.message)}
    })());
  };
  const prepareCourt=(team,name)=>{
    if(!isCustomImage(team.court?.overlayURL))return;
    jobs.push((async()=>{
      team.court.overlayURL=exportCourtURL(team.court.overlayURL,assets);
      try{validateImageSize(await measure(team.court.overlayURL),'court')}
      catch(e){throw Error(name+' court: '+e.message)}
    })());
  };

  prepareLogo(result,'League');
  for(const [index,court]of (result.courts||[]).entries())if(court)prepareCourt({court},window.HLSTournamentCourts.rounds[index]||'Tournament');
  for(const team of [...(result.teams||[]),...(result.starTeams||[])]){
    const name=teamDisplayName(team);
    prepareLogo(team,name);
    prepareCourt(team,name);
  }
  for(const team of [...(result.teams||[]),...(result.starTeams||[])]){
    const office=team.frontOffice;
    if(!isCustomImage(office?.adsURL))continue;
    jobs.push((async()=>{
      office.adsURL=exportOtherImageURL(office.adsURL,assets);
      try{
        const size=await measure(office.adsURL);
        if(!Number.isInteger(size.width)||size.width<1||!Number.isInteger(size.height)||size.height<1)throw Error('Invalid image dimensions.');
        office.adSize=size.width;
      }catch(e){throw Error(team.name+' announcer table: '+e.message)}
    })());
  }
  await Promise.all(jobs);
  return result;
}

const $=s=>document.querySelector(s), el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
let league,template,assets=[],view='home',selected=0,teamList='teams',dirty=false,pickPath=null,recent=[],imageReady=false,toastTimer,teamColorSlot=0,teamPicker=false,pickerOriginalColors=null,pickerOriginalValue=null,pickerTeam=null,pickerLoadToken=0;
let teamCountBusy=false;
const locationSelections=new Map();
const HOOPLAND_HOMETOWNS=[["Albania","AL",[["","",[["Bajram Curri",4236,2008],["Berat",4071,1995],["Burrel",4161,2001],["Çorovodë",4051,2024],["Durrës",4132,1944],["Elbasan",4112,2008],["Fier",4073,1956],["Gjirokastër",4008,2014],["Gramsh",4087,2019],["Kavajë",4118,1956],["Korçë",4062,2077],["Kukës",4208,2043],["Laç",4163,1971],["Lezhë",4179,1965],["Lushnjë",4094,1971],["Peshkopi",4168,2043],["Pogradec",4090,2066],["Poliçan",4061,1998],["Shkodër",4207,1951],["Tirana",4133,1982],["Ura Vajgurore",4077,1994],["Vlorë",4047,1949]]]]],["Algeria","DZ",[["","",[["Algiers",3675,306],["Annaba",3690,777],["Batna",3556,617],["Béchar",3161,-222],["Béjaïa",3676,508],["Biskra",3485,572],["Blida",3647,283],["Chlef",3617,133],["Constantine",3637,661],["El Oued",3337,687],["Guelma",3646,743],["Khenchela",3543,715],["Oran",3570,-63],["Saida",3485,15],["Setif",3619,542],["Skikda",3687,691],["Tiarat",3537,132],["Tiaret",3538,132],["Tizi Ouzou",3671,405],["Tlemcen",3488,-132]]]]],["Argentina","AR",[["","",[["Buenos Aires",-3461,-5838],["Córdoba",-3142,-6418],["Corrientes",-2748,-5883],["Formosa",-2618,-5818],["La Plata",-3492,-5796],["Mar del Plata",-3800,-5756],["Mendoza",-3289,-6884],["Neuquén",-3895,-6806],["Posadas",-2737,-5590],["Resistencia",-2746,-5898],["Rosario",-3295,-6064],["Salta",-2479,-6541],["San Juan",-3154,-6854],["San Miguel de Tucumán",-2682,-6522],["San Salvador de Jujuy",-2419,-6530],["Santa Fe",-3163,-6070]]]]],["Australia","AU",[["","",[["Adelaide",-3492,13862],["Albury-Wodonga",-3608,14692],["Ballarat",-3756,14385],["Bendigo",-3676,14428],["Brisbane",-2747,15303],["Bundaberg",-2487,15235],["Cairns",-1692,14577],["Canberra",-3528,14913],["Coffs Harbour",-3030,15311],["Darwin",-1246,13084],["Geelong",-3815,14436],["Gold Coast",-2800,15343],["Hobart",-4288,14733],["Launceston",-4143,14714],["Mackay",-2114,14919],["Melbourne",-3781,14496],["Newcastle",-3292,15177],["Perth",-3195,11586],["Rockhampton",-2337,15050],["Sunshine Coast",-2665,15309],["Sydney",-3387,15121],["Toowoomba",-2756,15195],["Townsville",-1926,14680],["Wollongong",-3442,15088]]]]],["Austria","AT",[["","",[["Amstetten",4812,1488],["Baden",4801,1623],["Dornbirn",4741,975],["Feldkirch",4724,960],["Graz",4707,1542],["Innsbruck",4726,1139],["Klagenfurt",4663,1431],["Krems",4841,1561],["Kufstein",4758,1217],["Leoben",4738,1510],["Linz",4829,1429],["Perchtoldsdorf",4810,1631],["Salzburg",4780,1304],["Schwechat",4814,1647],["Steyr",4804,1441],["Ternitz",4772,1604],["Traun",4822,1423],["Vienna",4821,1637],["Villach",4661,1385],["Wels",4816,1402],["Wiener Neustadt",4781,1625]]]]],["Bahamas","BS",[["","",[["Albert Town",2572,-7929],["Alice Town",2572,-7783],["Andros Town",2504,-7804],["Arthur's Town",2462,-7567],["Clarence Town",2310,-7498],["Cockburn Town",2404,-7452],["Colonel Hill",2284,-7410],["Coopers Town",2669,-7732],["Duncan Town",2230,-7398],["Dunmore Town",2572,-7642],["Freeport",2653,-7870],["Freetown",2645,-7823],["George Town",2352,-7578],["Hard Bargain",2622,-7883],["High Rock",2662,-7828],["Marsh Harbour",2654,-7706],["Matthew Town",2095,-7367],["Nassau",2503,-7740],["Port Nelson",2371,-7481],["Snug Corner",2605,-7838],["West End",2671,-7899]]]]],["Bangladesh","BD",[["","",[["Bagerhat",2265,8979],["Barisal",2270,9037],["Bogra",2485,8937],["Chittagong",2234,9183],["Comilla",2346,9118],["Cox's Bazar",2144,9201],["Dhaka",2381,9041],["Dinajpur",2563,8863],["Jessore",2317,8921],["Khulna",2281,8955],["Mymensingh",2476,9041],["Narayanganj",2363,9050],["Narsingdi",2392,9072],["Pabna",2397,8913],["Rajshahi",2437,8861],["Rangpur",2574,8926],["Saidpur",2578,8890],["Sirsaganj",2445,8978],["Sylhet",2490,9186],["Tangail",2425,8992]]]]],["Barbados","BB",[["","",[["Bathsheba",1322,-5952],["Bridgetown",1310,-5962],["Durants",1315,-5956],["Holetown",1319,-5963],["Maxwell",1306,-5959],["Oistins",1307,-5953],["Paynes Bay",1316,-5964],["Rockley",1307,-5958],["Speightstown",1325,-5965],["Weston",1323,-5965]]]]],["Belarus","BY",[["","",[["Babruysk",5314,2922],["Baranovichi",5314,2601],["Barysaw",5423,2851],["Biaroza",5253,2499],["Brest",5210,2373],["Homyel",5245,3098],["Hrodna",5368,2383],["Mahilyow",5391,3034],["Maladzyechna",5432,2685],["Masty",5341,2454],["Minsk",5390,2756],["Mogilev",5390,3033],["Navapolatsk",5554,2861],["Orsha",5452,3042],["Pinsk",5213,2610],["Pruzhany",5256,2446],["Salihorsk",5279,2754],["Slonim",5309,2532],["Vawkavysk",5316,2444],["Vitebsk",5519,3020]]]]],["Belgium","BE",[["","",[["Aalst",5094,404],["Antwerp",5122,440],["Bruges",5121,323],["Brussels",5085,435],["Charleroi",5041,444],["Genk",5097,550],["Ghent",5105,372],["Hasselt",5093,534],["Kortrijk",5083,327],["Leuven",5088,470],["Liège",5063,557],["Mechelen",5103,449],["Mons",5045,395],["Namur",5047,487],["Ostend",5122,292],["Roeselare",5095,313],["Seraing",5061,549],["Sint-Niklaas",5117,414],["Tournai",5061,339],["Verviers",5059,586]]]]],["Bosnia","BA",[["","",[["Banja Luka",4477,1719],["Bihać",4481,1587],["Bijeljina",4475,1922],["Bosanska Krupa",4488,1615],["Brčko",4487,1881],["Cazin",4498,1594],["Doboj",4473,1809],["Goražde",4367,1898],["Gradačac",4487,1843],["Kakanj",4413,1812],["Livno",4382,1700],["Mostar",4334,1780],["Prijedor",4498,1671],["Sarajevo",4385,1836],["Srebrenik",4470,1848],["Tešanj",4461,1798],["Travnik",4423,1766],["Trebinje",4271,1834],["Tuzla",4454,1868],["Zenica",4420,1791],["Živinice",4445,1865]]]]],["Brazil","BR",[["","",[["Belem",-146,-4850],["Belo Horizonte",-1992,-4393],["Brasilia",-1578,-4793],["Campinas",-2291,-4706],["Curitiba",-2543,-4927],["Duque de Caxias",-2279,-4330],["Fortaleza",-372,-3854],["Goiânia",-1668,-4925],["Guarulhos",-2346,-4653],["Maceió",-966,-3574],["Manaus",-310,-6002],["Nova Iguaçu",-2276,-4346],["Porto Velho",-876,-6390],["Recife",-805,-3488],["Rio de Janeiro",-2291,-4317],["Salvador",-1297,-3850],["São Bernardo do Campo",-2369,-4656],["São Gonçalo",-2283,-4305],["São Luís",-254,-4428],["Sao Paulo",-2355,-4663]]]]],["Brunei","BN",[["","",[["Bandar Seri Begawan",489,11494],["Bandar Seri Kenangan",503,11510],["Bangar",471,11507],["Jerudong",490,11493],["Kampong Ayer",495,11494],["Kuala Balai",503,11503],["Kuala Belait",458,11517],["Kuala Lurah",447,11433],["Kuala Tutong",485,11510],["Lumapas",493,11500],["Mentiri",498,11493],["Pekan Muara",492,11507],["Seria",462,11461],["Sukang",488,11507],["Sungai Kedayan",532,11523],["Sungai Liang",462,11518],["Sungai Mau",488,11505],["Sungai Teraban",492,11495],["Tutong",480,11465],["Tutong",480,11463]]]]],["Bulgaria","BG",[["","",[["Asenovgrad",4200,2488],["Blagoevgrad",4202,2309],["Burgas",4251,2747],["Dobrich",4357,2783],["Gabrovo",4288,2531],["Haskovo",4194,2557],["Kazanlak",4262,2540],["Pazardzhik",4220,2433],["Pernik",4261,2303],["Pleven",4342,2461],["Plovdiv",4214,2475],["Ruse",4384,2595],["Shumen",4327,2693],["Sliven",4268,2632],["Sofia",4270,2332],["Stara Zagora",4243,2562],["Varna",4321,2792],["Veliko Tarnovo",4308,2563],["Vratsa",4321,2355],["Yambol",4248,2651]]]]],["Cambodia","KH",[["","",[["Battambang",1310,10320],["Kampong Cham",1200,10547],["Krong Bavet",1109,10578],["Krong Chbar Mon",1155,10478],["Krong Kampong Chhnang",1225,10456],["Krong Kampong Speu",1146,10453],["Krong Kampong Thom",1271,10489],["Krong Pailin",1284,10261],["Krong Preah Sihanouk",1061,10353],["Krong Prey Veng",1149,10532],["Krong Pursat",1253,10392],["Krong Samraong",1265,10357],["Krong Stueng Saen",1236,10502],["Krong Svay Rieng",1108,10580],["Krong Ta Khmau",1153,10494],["Phnom Penh",1156,10493],["Siem Reap",1336,10386],["Sihanoukville",1062,10352]]]]],["Cameroon","CM",[["","",[["Bafang",515,1018],["Bafoussam",548,1042],["Bamenda",596,1016],["Batouri",443,1437],["Bertoua",458,1368],["Douala",405,977],["Dschang",545,1007],["Ebolowa",292,1116],["Edea",380,1013],["Foumban",573,1090],["Garoua",930,1340],["Kribi",295,992],["Kumba",464,945],["Limbe",401,921],["Loum",472,974],["Maroua",1059,1432],["Mbouda",563,1015],["Ngaoundéré",732,1358],["Nkongsamba",496,994],["Yaoundé",385,1150]]]]],["Canada","CA",[["","",[["Calgary",5105,-11407],["Calgary",5104,-11407],["Edmonton",5354,-11349],["Edmonton",5355,-11349],["Halifax",4465,-6358],["Hamilton",4326,-7987],["Kitchener",4345,-8049],["Kitchener",4345,-8048],["London",4298,-8125],["Montreal",4550,-7357],["Oshawa",4390,-7887],["Ottawa",4542,-7569],["Quebec City",4681,-7121],["Regina",5045,-10462],["Saskatoon",5214,-10665],["Sherbrooke",4540,-7190],["St. Catharines",4316,-7925],["St. John's",4756,-5271],["Toronto",4370,-7942],["Toronto",4365,-7938],["Vancouver",4928,-12312],["Victoria",4843,-12337],["Windsor",4231,-8304],["Winnipeg",4989,-9714],["Winnipeg",4990,-9714]]]]],["Cayman Islands","KY",[["","",[["Barefoot Beach",1931,-8131],["Bodden Town",1928,-8125],["Breakers",1930,-8122],["Cayman Brac",1972,-7980],["Cayman Kai",1939,-8129],["East End",1930,-8114],["East End Village",1928,-8124],["George Town",1929,-8137],["Gun Bay",1932,-8115],["Half Moon Bay",1933,-8118],["Little Cayman",1969,-8004],["North Side",1939,-8140],["Northward",1936,-8114],["Rum Point",1938,-8126],["Stake Bay",1971,-7975],["West Bay",1937,-8142],["West End",1937,-8130]]]]],["Chile","CL",[["","",[["Antofagasta",-2365,-7040],["Arica",-1848,-7031],["Calama",-2246,-6893],["Chillán",-3661,-7210],["Concepción",-3683,-7305],["Copiapó",-2737,-7033],["Coquimbo",-2995,-7134],["Curicó",-3498,-7124],["Iquique",-2022,-7015],["La Serena",-2990,-7125],["Los Ángeles",-3747,-7235],["Osorno",-4057,-7313],["Punta Arenas",-5316,-7092],["Rancagua",-3417,-7074],["San Antonio",-3359,-7161],["Santiago",-3345,-7067],["Talca",-3543,-7165],["Temuco",-3874,-7259],["Valdivia",-3981,-7325],["Valparaíso",-3305,-7162]]]]],["China","CN",[["","",[["Beijing",3990,11641],["Changsha",2823,11294],["Chengdu",3057,10407],["Chongqing",2943,10691],["Dalian",3891,12161],["Guangzhou",2313,11326],["Hangzhou",3027,12016],["Harbin",4580,12653],["Jinan",3665,11712],["Kunming",2504,10272],["Lhasa",2965,9112],["Nanjing",3206,11880],["Qingdao",3607,12038],["Shanghai",3123,12147],["Shenzhen",2254,11406],["Shijiazhuang",3804,11451],["Tianjin",3934,11736],["Urumqi",4383,8762],["Wuhan",3059,11431],["Xi'an",3434,10894]]]]],["Colombia","CO",[["","",[["Armenia",453,-7568],["Barranquilla",1096,-7480],["Bogotá",461,-7408],["Bucaramanga",713,-7312],["Cali",345,-7653],["Cartagena",1039,-7548],["Cúcuta",789,-7251],["Ibagué",444,-7524],["Manizales",507,-7552],["Medellín",624,-7558],["Neiva",294,-7529],["Pasto",121,-7728],["Pereira",481,-7569],["Popayán",244,-7661],["Riohacha",1154,-7291],["Santa Marta",1124,-7420],["Sincelejo",929,-7540],["Tunja",554,-7336],["Valledupar",1046,-7324],["Villavicencio",413,-7363]]]]],["Congo","CG",[["","",[["Brazzaville",-426,1524],["Dolisie",-420,1267],["Ewo",-88,1482],["Gamboma",-187,1586],["Impfondo",162,1807],["Kinkala",-436,1476],["Loandjili",-476,1186],["Madingou",-416,1355],["Makoua",-1,1558],["Mossendjo",-295,1273],["Nkayi",-418,1328],["Ouesso",161,1605],["Owando",-51,1595],["Pointe-Noire",-479,1186],["Sibiti",-369,1335]]]]],["Costa Rica","CR",[["","",[["Alajuela",1002,-8421],["Bagaces",1052,-8525],["Cartago",987,-8392],["Ciudad Cortés",896,-8353],["Esparza",998,-8466],["Golfito",862,-8315],["Heredia",1000,-8412],["Liberia",1064,-8544],["Limón",999,-8303],["Nicoya",1014,-8545],["Puntarenas",998,-8484],["Purral",995,-8407],["Quesada",1032,-8443],["Sabanilla",995,-8405],["San Isidro",937,-8369],["San José",993,-8409],["San Vito",883,-8296],["Santa Cruz",1026,-8558],["Sixaola",952,-8262],["Turrialba",990,-8368]]]]],["Croatia","HR",[["","",[["Bjelovar",4590,1685],["Dubrovnik",4265,1809],["Karlovac",4549,1555],["Kaštela",4355,1648],["Koprivnica",4616,1683],["Opatija",4534,1431],["Osijek",4555,1870],["Pula",4487,1385],["Rijeka",4533,1444],["Samobor",4580,1572],["Sesvete",4583,1608],["Sibenik",4373,1590],["Sisak",4548,1638],["Split",4351,1644],["Varaždin",4631,1634],["Vinkovci",4529,1881],["Virovitica",4583,1738],["Vukovar",4535,1899],["Zadar",4412,1523],["Zagreb",4582,1598]]]]],["Cuba","CU",[["","",[["Bayamo",2038,-7664],["Cabaiguán",2208,-7950],["Camagüey",2138,-7792],["Cárdenas",2304,-8120],["Ciego de Ávila",2184,-7876],["Cienfuegos",2215,-8045],["Florida",2152,-7823],["Guantánamo",2014,-7521],["Havana",2311,-8237],["Holguín",2089,-7626],["Las Tunas",2096,-7695],["Manzanillo",2034,-7712],["Matanzas",2304,-8158],["Morón",2211,-7863],["Nueva Gerona",2188,-8280],["Pinar del Río",2242,-8370],["San José de las Lajas",2296,-8215],["Sancti Spíritus",2194,-7944],["Santa Clara",2240,-7997],["Santiago de Cuba",2002,-7583]]]]],["Cyprus","CY",[["","",[["Aradippou",3495,3359],["Athienou",3487,3361],["Avgorou",3503,3378],["Deryneia",3507,3398],["Famagusta",3512,3395],["Kyperounta",3492,3299],["Kyrenia",3534,3332],["Larnaca",3492,3363],["Limassol",3468,3304],["Lysi",3534,3362],["Morphou",3520,3298],["Nicosia",3517,3337],["Pano Lefkara",3480,3328],["Paphos",3477,3243],["Paralimni",3504,3403],["Parekklisia",3474,3314],["Protaras",3501,3406],["Sotira",3504,3394],["Trikomo",3528,3374],["Xylophagou",3504,3373]]]]],["Czech Republic","CZ",[["","",[["Brno",4920,1661],["České Budějovice",4897,1447],["Chomutov",5046,1341],["Děčín",5078,1421],["Havířov",4977,1844],["Hradec Králové",5021,1583],["Jihlava",4940,1559],["Karviná",4985,1854],["Kladno",5015,1410],["Kroměříž",4930,1739],["Liberec",5077,1506],["Olomouc",4959,1725],["Ostrava",4982,1826],["Pardubice",5004,1578],["Plzeň",4974,1337],["Prague",5008,1444],["Prostějov",4947,1711],["Teplice",5064,1380],["Třebíč",4921,1587],["Zlín",4923,1767]]]]],["Denmark","DK",[["","",[["Aalborg",5705,994],["Aarhus",5616,1020],["Ballerup",5573,1236],["Copenhagen",5568,1257],["Esbjerg",5547,845],["Frederiksberg",5568,1252],["Greve",5558,1229],["Helsingør",5604,1261],["Herning",5614,897],["Horsens",5586,985],["Hørsholm",5588,1252],["Køge",5546,1218],["Kolding",5549,947],["Næstved",5523,1176],["Odense",5540,1040],["Randers",5646,1004],["Roskilde",5564,1208],["Silkeborg",5617,955],["Vejle",5571,954],["Viborg",5645,940]]]]],["Dominican Republic","DO",[["","",[["Azua",1845,-7072],["Bajos de Haina",1841,-7003],["Baní",1829,-7033],["Bonao",1893,-7041],["Esperanza",1959,-7095],["Higüey",1862,-6871],["La Romana",1843,-6897],["La Vega",1922,-7052],["Moca",1940,-7053],["Neiba",1850,-7142],["Puerto Plata",1980,-7070],["San Cristóbal",1842,-7011],["San Francisco de Macorís",1931,-7026],["San Juan de la Maguana",1881,-7123],["San Pedro de Macorís",1845,-6930],["Santiago",1945,-7070],["Santo Domingo",1849,-6993],["Santo Domingo Este",1849,-6986],["Villa Altagracia",1867,-7017]]]]],["Ecuador","EC",[["","",[["Ambato",-124,-7862],["Babahoyo",-180,-7953],["Cuenca",-290,-7901],["Durán",-219,-7987],["Eloy Alfaro",-122,-7984],["Guayaquil",-217,-7992],["Huaquillas",-348,-8024],["Ibarra",35,-7812],["La Libertad",-223,-8090],["Loja",-399,-7920],["Machala",-326,-7996],["Manta",-96,-8071],["Milagro",-213,-7959],["Portoviejo",-104,-8046],["Quevedo",-103,-7946],["Quito",-23,-7852],["Riobamba",-166,-7865],["Sangolquí",-33,-7835],["Santa Elena",-223,-8086],["Santo Domingo",-25,-7918]]]]],["Egypt","EG",[["","",[["Alexandria",3122,2996],["Aswan",2409,3290],["Asyut",2718,3118],["Beni Suef",2907,3110],["Cairo",3004,3124],["Damietta",3142,3181],["Fayyum",2931,3084],["Giza",3001,3121],["Hurghada",2726,3381],["Ismailia",3060,3227],["Luxor",2569,3264],["Minya",2812,3074],["Port Said",3122,3227],["Qena",2616,3273],["Shubra El-Kheima",3013,3126],["Sohag",2655,3169],["Suez",3000,3255],["Tanta",3079,3100],["Zagazig",3058,3150]]]]],["El Salvador","SV",[["","",[["Ahuachapán",1393,-8985],["Apopa",1381,-8918],["Chalchuapa",1399,-8967],["Cojutepeque",1371,-8894],["Delgado",1372,-8917],["La Unión",1333,-8784],["Mejicanos",1374,-8921],["Quezaltepeque",1383,-8914],["San Francisco Gotera",1370,-8810],["San Marcos",1379,-8924],["San Miguel",1348,-8818],["San Salvador",1370,-8919],["San Vicente",1364,-8878],["Santa Ana",1400,-8955],["Santa Tecla",1368,-8928],["Sonsonate",1372,-8972],["Soyapango",1371,-8915],["Usulután",1335,-8843],["Zacatecoluca",1351,-8887]]]]],["Estonia","EE",[["","",[["Haapsalu",5894,2354],["Jõhvi",5936,2742],["Keila",5931,2442],["Kiviõli",5935,2698],["Kohtla-Järve",5940,2727],["Kuressaare",5825,2250],["Maardu",5948,2504],["Narva",5938,2819],["Paide",5888,2556],["Pärnu",5838,2450],["Põlva",5806,2707],["Rakvere",5935,2636],["Sillamäe",5940,2776],["Tallinn",5944,2475],["Tartu",5838,2673],["Türi",5881,2546],["Valga",5778,2605],["Viljandi",5836,2559],["Võru",5784,2702]]]]],["Finland","FI",[["","",[["Espoo",6021,2466],["Hämeenlinna",6100,2446],["Helsinki",6017,2494],["Joensuu",6260,2976],["Jyväskylä",6224,2575],["Kokkola",6384,2313],["Kotka",6047,2695],["Kouvola",6087,2670],["Kuopio",6289,2768],["Lahti",6098,2566],["Lappeenranta",6106,2819],["Oulu",6501,2547],["Pori",6149,2180],["Porvoo",6039,2566],["Rovaniemi",6650,2572],["Seinäjoki",6279,2283],["Tampere",6150,2376],["Turku",6045,2227],["Vaasa",6310,2162],["Vantaa",6029,2504]]]]],["France","FR",[["","",[["Angers",4748,-56],["Bordeaux",4484,-58],["Cergy",4904,207],["Dijon",4732,504],["Grenoble",4519,574],["Le Havre",4949,10],["Lille",5063,306],["Lyon",4575,485],["Marseille",4330,537],["Montpellier",4361,388],["Nantes",4722,-155],["Nice",4371,726],["Nîmes",4384,436],["Paris",4886,235],["Reims",4926,403],["Rennes",4812,-168],["Saint-Étienne",4544,439],["Strasbourg",4858,775],["Toulon",4312,593],["Toulouse",4360,144]]]]],["Georgia","GE",[["","",[["Akhaltsikhe",4164,4299],["Batumi",4164,4163],["Borjomi",4185,4341],["Dusheti",4234,4450],["Gardabani",4146,4511],["Gori",4198,4412],["Gurjaani",4175,4579],["Khashuri",4199,4359],["Kobuleti",4182,4178],["Kutaisi",4227,4269],["Marneuli",4147,4481],["Poti",4215,4167],["Rustavi",4153,4500],["Samtredia",4215,4234],["Senaki",4227,4207],["Tbilisi",4172,4483],["Telavi",4192,4547],["Tsqaltubo",4233,4260],["Zugdidi",4251,4187]]]]],["Germany","DE",[["","",[["Aachen",5078,608],["Berlin",5252,1340],["Bielefeld",5203,853],["Bochum",5148,722],["Cologne",5094,696],["Dortmund",5151,747],["Dresden",5105,1374],["Düsseldorf",5123,677],["Essen",5146,701],["Frankfurt",5011,868],["Halle (Saale)",5148,1145],["Hamburg",5355,999],["Hannover",5238,973],["Kassel",5132,949],["Leipzig",5134,1237],["Mannheim",4949,847],["Munich",4814,1158],["Nuremberg",4945,1108],["Stuttgart",4878,918],["Wuppertal",5126,715]]]]],["Ghana","GH",[["","",[["Accra",560,-19],["Adenta",575,-24],["Ashiaman",576,-10],["Atwima Koforidua",661,-159],["Cape Coast",510,-125],["Ho",659,47],["Koforidua",608,-26],["Kumasi",669,-162],["Madina",567,-19],["Obuasi",621,-167],["Sefwi-Wiawso",619,-229],["Sekondi-Takoradi",494,-170],["Sunyani",733,-232],["Takoradi",489,-175],["Tamale",941,-85],["Techiman",759,-193],["Tema",561,-99],["Teshie",558,-11],["Winneba",533,-71]]]]],["Greece","GR",[["","",[["Alexandroupoli",4085,2587],["Athens",3798,2373],["Chalkida",3846,2361],["Chania",3551,2402],["Heraklion",3534,2514],["Ioannina",3966,2085],["Kalamata",3704,2211],["Kavala",4094,2441],["Komotini",4112,2540],["Lamia",3890,2243],["Larissa",3964,2242],["Mytilene",3911,2655],["Patras",3823,2175],["Rhodes",3643,2822],["Serres",4109,2355],["Thessaloniki",4064,2294],["Trikala",3956,2177],["Tripoli",3751,2238],["Veria",4052,2220],["Volos",3936,2294]]]]],["Guatemala","GT",[["","",[["Amatitlán",1448,-9062],["Chichicastenango",1494,-9111],["Chimaltenango",1467,-9082],["Chinautla",1475,-9044],["Coatepeque",1471,-9187],["Cobán",1547,-9038],["Escuintla",1430,-9078],["Guatemala City",1463,-9051],["Huehuetenango",1532,-9147],["Mixco",1463,-9061],["Patzún",1462,-9099],["Quetzaltenango",1483,-9152],["San Juan Sacatepéquez",1473,-9063],["San Miguel Petapa",1450,-9055],["Sololá",1477,-9119],["Villa Canales",1446,-9055],["Villa Nueva",1453,-9059]]]]],["Haiti","HT",[["","",[["Cap-Haïtien",1975,-7220],["Carrefour",1854,-7240],["Delmas",1854,-7230],["Fond Parisien",1824,-7191],["Fort-Liberté",1966,-7184],["Gonaïves",1945,-7268],["Gressier",1854,-7239],["Hinche",1915,-7202],["Jacmel",1823,-7254],["Jean-Rabel",1985,-7315],["Jérémie",1865,-7412],["Léogâne",1851,-7263],["Les Anglais",1829,-7424],["Les Cayes",1819,-7375],["Limbé",1969,-7234],["Ouanaminthe",1955,-7173],["Pétion-Ville",1851,-7229],["Petit-Goâve",1843,-7286],["Port-au-Prince",1859,-7231],["Saint-Marc",1911,-7270]]]]],["Honduras","HN",[["","",[["Choloma",1561,-8795],["Comayagua",1446,-8764],["Danlí",1403,-8659],["El Progreso",1540,-8780],["Intibucá",1432,-8817],["Juticalpa",1467,-8622],["La Ceiba",1576,-8678],["La Esperanza",1432,-8818],["La Lima",1542,-8792],["Olanchito",1548,-8658],["Puerto Cortés",1583,-8793],["San Juan Pueblo",1426,-8797],["San Pedro Sula",1550,-8803],["Santa Bárbara",1498,-8818],["Santa Rosa de Copán",1477,-8878],["Siguatepeque",1460,-8783],["Tegucigalpa",1408,-8721],["Tela",1577,-8748],["Tocoa",1569,-8750],["Yoro",1513,-8713]]]]],["Hong Kong","HK",[["","",[["Central Hong Kong",2228,11416],["Fanling-Sheung Shui",2249,11413],["Hong Kong",2232,11417],["Kowloon",2231,11416],["Kwai Chung",2236,11413],["Kwun Tong",2231,11422],["Ma On Shan",2242,11423],["North Hong Kong",2251,11413],["Sai Kung",2238,11427],["Sha Tin",2239,11419],["Tai Po",2245,11417],["Tseung Kwan O",2231,11426],["Tsing Yi",2235,11410],["Tsuen Wan",2237,11410],["Tuen Mun",2239,11397],["Tung Chung",2229,11394],["Yuen Long Kau Hui",2244,11402]]]]],["Hungary","HU",[["","",[["Békéscsaba",4667,2109],["Budapest",4750,1904],["Debrecen",4753,2163],["Dunaújváros",4696,1894],["Eger",4790,2037],["Győr",4769,1763],["Hódmezővásárhely",4642,2015],["Kaposvár",4637,1780],["Kecskemét",4691,1969],["Miskolc",4810,2078],["Nagykanizsa",4646,1699],["Nyíregyháza",4796,2172],["Pécs",4608,1823],["Sopron",4768,1659],["Szeged",4625,2014],["Székesfehérvár",4719,1842],["Szombathely",4723,1662],["Tatabánya",4758,1842],["Veszprém",4709,1791],["Zalaegerszeg",4684,1684]]]]],["Iceland","IS",[["","",[["Akranes",6432,-2206],["Akureyri",6569,-1810],["Borgarnes",6457,-2186],["Egilsstadir",6527,-1439],["Hafnarfjordur",6407,-2194],["Husavik",6604,-1734],["Hveragerdi",6400,-2119],["Hvolsvollur",6375,-2022],["Keflavik",6400,-2257],["Kopavogur",6411,-2189],["Njardvik",6398,-2256],["Olafsvik",6489,-2371],["Reykjavik",6415,-2194],["Sandgerdi",6406,-2272],["Saudarkrokur",6575,-1964],["Selfoss",6393,-2100],["Seydisfjordur",6526,-1401],["Vestmannaeyjar",6344,-2027]]]]],["India","IN",[["","",[["Ahmedabad",2302,7257],["Bangalore",1297,7759],["Bhopal",2326,7741],["Chennai",1308,8027],["Delhi",2861,7721],["Hyderabad",1738,7849],["Indore",2272,7586],["Jaipur",2691,7579],["Kanpur",2645,8033],["Kolkata",2257,8836],["Lucknow",2685,8095],["Mumbai",1908,7288],["Nagpur",2115,7909],["Patna",2559,8514],["Pimpri-Chinchwad",1863,7381],["Pune",1852,7386],["Thane",1922,7298],["Vadodara",2231,7318],["Visakhapatnam",1769,8322]]]]],["Indonesia","ID",[["","",[["Balikpapan",-126,11685],["Bandar Lampung",-540,10526],["Bandung",-691,10761],["Bekasi",-623,10699],["Bogor",-660,10682],["Cilegon",-602,10605],["Cimahi",-687,10754],["Denpasar",-865,11522],["Jakarta",-621,10685],["Makassar",-515,11943],["Malang",-797,11263],["Medan",360,9867],["Padang",-95,10035],["Palembang",-292,10475],["Pekanbaru",51,10145],["Samarinda",-50,11715],["Semarang",-697,11042],["Serang",-611,10615],["Surabaya",-726,11275],["Tangerang",-618,10663]]]]],["Iran","IR",[["","",[["Ahvaz",3132,4867],["Ardabil",3827,4829],["Babol",3656,5268],["Bandar Abbas",2718,5627],["Birjand",3287,5922],["Bojnourd",3747,5733],["Eslamshahr",3556,5124],["Gorgan",3685,5443],["Hamedan",3480,4851],["Isfahan",3265,5167],["Karaj",3584,5098],["Kermanshah",3431,4707],["Malayer",3428,4844],["Mashhad",3626,5962],["Qom",3464,5088],["Rasht",3728,4958],["Sari",3656,5308],["Shahrekord",3233,5086],["Shiraz",2960,5255],["Tabriz",3808,4629],["Tehran",3569,5139],["Urmia",3755,4507],["Yazd",3190,5436],["Zahedan",2950,6086]]]]],["Iraq","IQ",[["","",[["Amara",3184,4715],["Ba'qubah",3375,4463],["Baghdad",3332,4437],["Basra",3051,4778],["Duhok",3687,4299],["Erbil",3619,4401],["Fallujah",3335,4379],["Hilla",3247,4443],["Karbala",3261,4402],["Kirkuk",3547,4439],["Kufa",3206,4442],["Kut",3252,4582],["Mosul",3635,4314],["Najaf",3200,4431],["Nasiriyah",3104,4627],["Ramadi",3342,4331],["Samarra",3420,4388],["Samawah",3133,4529],["Sulaymaniyah",3556,4544],["Tikrit",3461,4368]]]]],["Ireland","IE",[["","",[["Athlone",5342,-794],["Bray",5320,-613],["Carlow",5284,-693],["Clonmel",5237,-770],["Cork",5190,-849],["Drogheda",5372,-635],["Dublin",5335,-626],["Dundalk",5400,-640],["Ennis",5285,-899],["Galway",5327,-906],["Greystones",5315,-607],["Kilkenny",5265,-724],["Limerick",5266,-863],["Mullingar",5353,-735],["Naas",5322,-666],["Navan",5365,-668],["Nenagh",5286,-820],["Sligo",5428,-848],["Tralee",5227,-970],["Waterford",5226,-711]]]]],["Israel","IL",[["","",[["Ashdod",3180,3466],["Ashkelon",3167,3457],["Beer Sheva",3125,3479],["Bet Shemesh",3175,3499],["Bnei Brak",3208,3484],["Hadera",3244,3492],["Haifa",3279,3499],["Herzliya",3217,3485],["Holon",3201,3478],["Jerusalem",3177,3521],["Kfar Saba",3218,3491],["Lod",3195,3490],["Netanya",3232,3485],["Netivot",3142,3459],["Petah Tikva",3209,3489],["Ra'anana",3218,3487],["Ramat Gan",3208,3481],["Rishon LeZion",3197,3479],["Tel Aviv",3209,3478]]]]],["Italy","IT",[["","",[["Bari",4112,1687],["Bologna",4449,1134],["Cagliari",3922,911],["Florence",4377,1126],["Foggia",4146,1554],["Genoa",4441,895],["Messina",3819,1556],["Milan",4546,919],["Modena",4465,1093],["Naples",4085,1427],["Padua",4541,1188],["Palermo",3812,1336],["Parma",4480,1033],["Reggio Calabria",3811,1565],["Rome",4190,1250],["Salerno",4068,1479],["Trieste",4565,1378],["Turin",4507,769],["Venice",4544,1232],["Verona",4544,1099]]]]],["Jamaica","JM",[["","",[["Annotto Bay",1829,-7689],["Bog Walk",1796,-7697],["Browns Town",1840,-7706],["Falmouth",1848,-7761],["Half Way Tree",1802,-7679],["Kingston",1797,-7679],["Linstead",1813,-7703],["Lucea",1845,-7817],["Mandeville",1803,-7751],["May Pen",1797,-7723],["Montego Bay",1848,-7789],["Morant Bay",1789,-7641],["Old Harbour",1794,-7711],["Port Antonio",1818,-7646],["Port Maria",1838,-7689],["Portmore",1797,-7688],["Santa Cruz",1804,-7766],["Spanish Town",1799,-7696],["Stony Hill",1807,-7680],["Yallahs",1787,-7687]]]]],["Japan","JP",[["","",[["Chiba",3561,14011],["Fukuoka",3359,13040],["Hiroshima",3439,13246],["Kagoshima",3160,13056],["Kawasaki",3553,13970],["Kobe",3469,13520],["Kumamoto",3280,13071],["Kyoto",3501,13577],["Matsuyama",3384,13277],["Nagoya",3518,13691],["Nara",3469,13580],["Niigata",3792,13904],["Okayama",3467,13394],["Osaka",3469,13550],["Saitama",3586,13965],["Sapporo",4306,14135],["Sendai",3825,14088],["Shizuoka",3498,13838],["Tokyo",3568,13976],["Yokohama",3544,13964]]]]],["Kazakhstan","KZ",[["","",[["Aktau",4365,5116],["Aktobe",5028,5717],["Almaty",4324,7695],["Atyrau",4711,5192],["Ekibastuz",5172,7532],["Karaganda",4980,7312],["Kokshetau",5328,6938],["Kostanay",5321,6362],["Kyzylorda",4485,6552],["Nur-Sultan",5116,7147],["Oral",5124,5139],["Pavlodar",5230,7694],["Petropavl",5487,6914],["Semey",5042,8026],["Shymkent",4232,6959],["Taldykorgan",4502,7838],["Taraz",4290,7137],["Temirtau",5005,7295],["Ust-Kamenogorsk",4997,8261],["Zhezkazgan",4779,6777]]]]],["Kuwait","KW",[["","",[["Abdullah Mubarak Al Sabah",2928,4810],["Ahmadi",2909,4808],["Al Fintas",2917,4812],["Al Wafrah",2853,4797],["Bayan",2932,4797],["Fahaheel",2908,4813],["Farwaniya",2929,4795],["Hawally",2933,4803],["Jahra",2934,4768],["Janub as Surrah",2920,4796],["Kuwait City",2938,4798],["Mangaf",2910,4813],["Mubarak Al Kabeer",2922,4804],["Sabah Al Salem",2923,4798],["Sabiya",2922,4810],["Salmiya",2934,4808]]]]],["Laos","LA",[["","",[["Ban Houayxay",2028,10042],["Ban Nahin",1824,10421],["Louang Namtha",2095,10142],["Luang Prabang",1988,10213],["Muang Xay",2042,10098],["Nong Khai",1788,10274],["Paksan",1839,10366],["Pakse",1512,10580],["Phongsali",2168,10210],["Phonhong",1850,10242],["Phonsavan",1942,10318],["Saravan",1572,10642],["Savannakhet",1656,10475],["Thakhek",1742,10483],["Vang Vieng",1893,10245],["Vientiane",1797,10260],["Xam Nua",2042,10403],["Xayaboury",1925,10175]]]]],["Latvia","LV",[["","",[["Bauska",5641,2419],["Cesis",5731,2528],["Daugavpils",5588,2654],["Dobele",5662,2327],["Gulbene",5717,2675],["Jelgava",5665,2371],["Jurmala",5695,2362],["Kraslava",5590,2717],["Kuldiga",5697,2197],["Liepaja",5654,2103],["Limbazi",5751,2472],["Ogre",5682,2461],["Rezekne",5651,2733],["Riga",5695,2411],["Salaspils",5686,2436],["Saldus",5667,2249],["Sigulda",5715,2486],["Tukums",5697,2316],["Valmiera",5754,2543],["Ventspils",5739,2156]]]]],["Lebanon","LB",[["","",[["Aley",3381,3560],["Anjar",3372,3599],["Baabda",3384,3554],["Baalbek",3400,3621],["Batroun",3426,3566],["Beirut",3390,3548],["Bint Jbeil",3319,3553],["Byblos",3412,3565],["Hermel",3437,3640],["Jounieh",3398,3562],["Majdal Anjar",3375,3598],["Marjayoun",3337,3557],["Nabatiye",3338,3544],["Qana",3313,3553],["Ras Baalbek",3432,3623],["Sidon",3356,3537],["Tripoli",3444,3585],["Tyre",3328,3520],["Zahle",3385,3590]]]]],["Libya","LY",[["","",[["Al Bayda",3276,2176],["Al Jaghbub",2986,2265],["Al Jawf",2421,2329],["Al Marj",3250,2083],["Awbari",2659,1277],["Az Zintan",3194,1284],["Bani Walid",3176,1399],["Benghazi",3212,2008],["Derna",3276,2264],["Ghat",2496,1017],["Jadu",3195,1202],["Misrata",3237,1509],["Murzuk",2592,1392],["Sabha",2704,1443],["Sirte",3119,1657],["Tarhuna",3244,1363],["Tripoli",3288,1319],["Ubari",2659,1278],["Zawiya",3275,1273],["Zliten",3247,1457]]]]],["Lithuania","LT",[["","",[["Alytus",5440,2405],["Elektrenai",5477,2465],["Garliava",5484,2381],["Jonava",5507,2428],["Kaunas",5490,2390],["Kedainiai",5529,2396],["Klaipeda",5570,2114],["Marijampole",5456,2335],["Mazeikiai",5631,2233],["Panevezys",5573,2436],["Plunge",5591,2184],["Radviliskis",5582,2354],["Siauliai",5593,2332],["Silute",5535,2148],["Taurage",5525,2229],["Telsiai",5598,2224],["Utena",5550,2560],["Vilkaviskis",5465,2303],["Vilnius",5469,2528],["Visaginas",5560,2643]]]]],["Luxembourg","LU",[["","",[["Belvaux",4952,599],["Bertrange",4963,605],["Bettembourg",4951,610],["Diekirch",4987,616],["Differdange",4952,589],["Dudelange",4949,609],["Echternach",4981,641],["Esch-sur-Alzette",4949,598],["Ettelbruck",4985,611],["Grevenmacher",4967,644],["Kayl",4948,601],["Luxembourg City",4961,613],["Mamer",4963,595],["Obercorn",4953,590],["Pétange",4956,588],["Rodange",4955,589],["Schifflange",4950,602],["Soleuvre",4951,599],["Strassen",4961,607],["Wiltz",4997,593]]]]],["Malaysia","MY",[["","",[["Alor Setar",613,10037],["Batu Pahat",185,10293],["Bintulu",317,11304],["George Town",541,10033],["Ipoh",460,10109],["Johor Bahru",149,10374],["Kajang",299,10179],["Kota Kinabalu",598,11607],["Kuala Lumpur",314,10169],["Kuantan",380,10332],["Kuching",155,11035],["Kulim",536,10055],["Malacca",219,10225],["Miri",440,11398],["Sandakan",584,11811],["Selayang",326,10164],["Seremban",273,10194],["Sibu",230,11184],["Tawau",425,11790]]]]],["Malta","MT",[["","",[["Birkirkara",3590,1446],["Birzebbuga",3583,1453],["Fgura",3587,1451],["Ghaxaq",3585,1453],["Luqa",3586,1448],["Marsaskala",3587,1456],["Mellieha",3596,1437],["Mgarr",3592,1437],["Mosta",3591,1443],["Naxxar",3592,1444],["Qormi",3588,1447],["Rabat",3588,1440],["San Pawl il-Bahar",3595,1441],["Siggiewi",3586,1447],["Sliema",3591,1450],["Tarxien",3587,1452],["Valletta",3590,1451],["Victoria",3604,1425],["Zabbar",3588,1453]]]]],["Mexico","MX",[["","",[["Acapulco",1685,-9982],["Campeche",1985,-9052],["Cancún",2117,-8685],["Ciudad Juárez",3169,-10642],["Culiacan",2479,-10741],["Guadalajara",2066,-10335],["Leon",2116,-10169],["Merida",2097,-8959],["Mexico City",1943,-9913],["Monclova",2691,-10142],["Monterrey",2569,-10032],["Oaxaca",1707,-9673],["Pachuca",2010,-9876],["Puebla",1904,-9821],["Querétaro",2059,-10039],["San Cristobal",1674,-9264],["Tijuana",3251,-11704],["Toluca",1928,-9966],["Tuxtla",1675,-9311],["Zapopan",2072,-10338]]]]],["Morocco","MA",[["","",[["Agadir",3042,-956],["Beni Mellal",3234,-636],["Casablanca",3357,-759],["El Jadida",3323,-851],["Fes",3402,-501],["Kenitra",3426,-658],["Khenifra",3294,-567],["Khouribga",3289,-690],["Ksar El Kebir",3574,-591],["Larache",3520,-615],["Marrakech",3163,-798],["Meknes",3388,-553],["Nador",3517,-293],["Oujda",3468,-191],["Rabat",3402,-684],["Settat",3300,-762],["Tangier",3576,-583],["Taza",3423,-401],["Tetouan",3557,-537]]]]],["Netherlands","NL",[["","",[["Alkmaar",5263,475],["Almere",5235,526],["Amersfoort",5216,539],["Amsterdam",5237,490],["Apeldoorn",5221,597],["Arnhem",5199,590],["Breda",5157,477],["Dordrecht",5181,469],["Eindhoven",5144,547],["Enschede",5222,689],["Groningen",5322,657],["Haarlem",5239,465],["Nijmegen",5181,584],["Rotterdam",5192,448],["Sittard",5100,587],["The Hague",5207,430],["Tilburg",5156,509],["Utrecht",5209,512],["Zaanstad",5245,481],["Zwolle",5252,609]]]]],["New Zealand","NZ",[["","",[["Auckland",-3685,17476],["Christchurch",-4353,17264],["Dunedin",-4588,17050],["Gisborne",-3866,17802],["Hamilton",-3779,17528],["Hastings",-3964,17685],["Invercargill",-4641,16835],["Levin",-4062,17529],["Masterton",-4096,17566],["Napier",-3949,17691],["New Plymouth",-3906,17408],["Palmerston North",-4035,17561],["Rotorua",-3814,17625],["Taupo",-3869,17607],["Tauranga",-3769,17617],["Timaru",-4440,17126],["Tokoroa",-3822,17588],["Wanganui",-3993,17505],["Wellington",-4129,17478],["Whangarei",-3573,17432]]]]],["Nicaragua","NI",[["","",[["Bilwi",1403,-8339],["Bluefields",1201,-8376],["Boaco",1247,-8566],["Chinandega",1264,-8714],["Estelí",1309,-8636],["Granada",1193,-8595],["Jinotega",1309,-8600],["Jinotepe",1185,-8620],["Juigalpa",1210,-8536],["León",1244,-8688],["Managua",1211,-8624],["Masaya",1197,-8609],["Matagalpa",1292,-8592],["Nueva Guinea",1193,-8489],["Nueva Segovia",1364,-8648],["Ocotal",1363,-8647],["Puerto Cabezas",1404,-8339],["Rivas",1143,-8583],["Siuna",1373,-8478],["Somoto",1347,-8658]]]]],["Nigeria","NG",[["","",[["Aba",511,737],["Abuja",906,750],["Asaba",621,669],["Bauchi",1032,984],["Benin City",634,560],["Enugu",652,751],["Ibadan",738,395],["Ikeja",660,334],["Ilorin",850,454],["Jos",992,889],["Kaduna",1053,744],["Kano",1200,859],["Lagos",652,338],["Maiduguri",1185,1316],["Makurdi",771,853],["Oyo",785,393],["Port Harcourt",482,705],["Uyo",504,794],["Warri",552,575]]]]],["North Macedonia","MK",[["","",[["Berovo",4170,2286],["Bitola",4103,2133],["Delčevo",4197,2277],["Gostivar",4179,2090],["Kavadarci",4143,2170],["Kochani",4193,2241],["Kratovo",4208,2218],["Kumanovo",4213,2171],["Ohrid",4112,2080],["Prilep",4135,2156],["Probištip",4200,2218],["Radoviš",4164,2246],["Resen",4109,2101],["Shtip",4174,2220],["Skopje",4200,2143],["Struga",4118,2068],["Strumica",4144,2264],["Tetovo",4201,2097],["Veles",4171,2177],["Vinica",4188,2251]]]]],["Norway","NO",[["","",[["Arendal",5846,877],["Askøy",6046,508],["Bergen",6039,532],["Drammen",5974,1020],["Fredrikstad",5922,1093],["Hamar",6079,1107],["Harstad",6880,1654],["Haugesund",5941,527],["Kongsberg",5967,965],["Kristiansand",5815,800],["Larvik",5905,1003],["Molde",6274,716],["Oslo",5991,1075],["Porsgrunn",5914,965],["Sandnes",5885,573],["Sarpsborg",5928,1111],["Stavanger",5897,573],["Tromsø",6965,1896],["Trondheim",6343,1040]]]]],["Pakistan","PK",[["","",[["Bahawalpur",2940,7167],["Faisalabad",3145,7314],["Gujranwala",3216,7419],["Gujrat",3257,7416],["Karachi",2486,6700],["Kasur",3112,7445],["Lahore",3152,7436],["Larkana",2756,6823],["Mardan",3420,7205],["Multan",3018,7146],["Okara",3081,7346],["Peshawar",3401,7154],["Quetta",3018,6698],["Rahim Yar Khan",2842,7030],["Rawalpindi",3368,7305],["Sahiwal",3067,7311],["Sargodha",3208,7267],["Sheikhupura",3171,7398],["Sialkot",3249,7453],["Wah Cantonment",3375,7283]]]]],["Palestine","PS",[["","",[["Ar-Ram",3188,3522],["Beit Jala",3171,3520],["Beit Lahia",3155,3451],["Bethlehem",3170,3520],["Deir al-Balah",3142,3434],["Gaza City",3152,3447],["Gaza Strip",3150,3447],["Hebron",3153,3510],["Jabalia",3153,3452],["Jenin",3246,3529],["Jericho",3186,3546],["Kafr Qasim",3210,3497],["Khan Yunis",3135,3431],["Nablus",3222,3526],["Qabatiya",3247,3530],["Qalqilya",3220,3498],["Rafah",3129,3426],["Ramallah",3190,3521],["Tubas",3232,3537],["Tulkarm",3232,3502]]]]],["Panama","PA",[["","",[["Aguadulce",823,-8055],["Arraiján",893,-7970],["Chepo",917,-7910],["Chilibre",915,-7970],["Chitré",797,-8043],["Colón",936,-7990],["Coloncito",895,-7963],["David",843,-8243],["La Cabima",908,-7940],["La Chorrera",888,-7978],["La Concepción",857,-8123],["Las Cumbres",910,-7962],["Pacora",908,-7930],["Panama City",898,-7952],["Pedregal",843,-8237],["San Isidro",812,-8098],["San Miguelito",903,-7950],["Santiago",810,-8098],["Tocumen",908,-7938],["Veracruz",908,-7963]]]]],["Paraguay","PY",[["","",[["Asunción",-2526,-5758],["Caacupé",-2539,-5723],["Caaguazú",-2545,-5602],["Capiatá",-2536,-5742],["Ciudad del Este",-2551,-5461],["Concepción",-2341,-5743],["Coronel Oviedo",-2541,-5644],["Encarnación",-2735,-5587],["Fernando de la Mora",-2533,-5755],["Itauguá",-2538,-5737],["Lambaré",-2535,-5761],["Luque",-2526,-5750],["Mariano Roque Alonso",-2517,-5755],["Pedro Juan Caballero",-2254,-5572],["Pilar",-2686,-5832],["Presidente Franco",-2562,-5461],["San Antonio",-2538,-5750],["San Lorenzo",-2534,-5751],["Villarrica",-2575,-5643],["Ypacaraí",-2539,-5727]]]]],["Peru","PE",[["","",[["Arequipa",-1641,-7154],["Ayacucho",-1316,-7422],["Callao",-1206,-7712],["Chiclayo",-677,-7984],["Chimbote",-909,-7858],["Chincha Alta",-1342,-7614],["Cusco",-1352,-7198],["Huancayo",-1207,-7521],["Huánuco",-993,-7624],["Ica",-1407,-7573],["Iquitos",-375,-7325],["Juliaca",-1550,-7013],["Lima",-1205,-7704],["Piura",-519,-8063],["Pucallpa",-838,-7455],["Sullana",-490,-8069],["Tacna",-1801,-7025],["Talara",-458,-8127],["Trujillo",-811,-7902],["Tumbes",-357,-8046]]]]],["Philippines","PH",[["","",[["Antipolo",1463,12112],["Bacolod City",1064,12297],["Butuan",895,12554],["Cagayan de Oro",848,12465],["Cebu City",1032,12389],["Davao City",719,12546],["General Santos",611,12517],["Iloilo City",1072,12256],["Las Piñas",1444,12098],["Makati City",1455,12102],["Manila",1460,12098],["Marikina City",1463,12106],["Muntinlupa",1441,12104],["Parañaque",1448,12102],["Pasig City",1458,12109],["Quezon City",1468,12104],["San Fernando",1503,12068],["San Jose del Monte",1481,12105],["Taguig City",1452,12106],["Zamboanga City",692,12208]]]]],["Poland","PL",[["","",[["Białystok",5313,2317],["Bydgoszcz",5312,1801],["Częstochowa",5081,1912],["Gdańsk",5435,1865],["Gdynia",5452,1853],["Gliwice",5029,1867],["Katowice",5026,1902],["Kielce",5087,2063],["Kraków",5006,1994],["Łódź",5176,1946],["Lublin",5125,2257],["Opole",5067,1793],["Poznań",5241,1693],["Radom",5140,2115],["Rzeszów",5004,2200],["Szczecin",5343,1455],["Toruń",5301,1860],["Warsaw",5223,2101],["Wrocław",5111,1704]]]]],["Portugal","PT",[["","",[["Amadora",3875,-923],["Aveiro",4064,-865],["Beja",3802,-787],["Braga",4155,-843],["Bragança",4181,-676],["Castelo Branco",3982,-749],["Coimbra",4021,-843],["Évora",3857,-791],["Funchal",3267,-1692],["Guarda",4054,-727],["Leiria",3974,-881],["Lisbon",3872,-914],["Ponta Delgada",3774,-2567],["Portalegre",3929,-743],["Porto",4116,-863],["Setúbal",3852,-889],["Viana do Castelo",4169,-883],["Vila Nova de Gaia",4113,-862],["Vila Real",4130,-774],["Viseu",4066,-791]]]]],["Puerto Rico","PR",[["","",[["Aibonito",1814,-6626],["Arecibo",1847,-6672],["Bayamón",1840,-6616],["Cabo Rojo",1809,-6715],["Caguas",1823,-6605],["Carolina",1841,-6599],["Coamo",1746,-6636],["Dorado",1846,-6627],["Fajardo",1833,-6565],["Guaynabo",1836,-6610],["Hormigueros",1814,-6711],["Isabela",1850,-6702],["Luquillo",1837,-6572],["Manatí",1843,-6649],["Mayagüez",1820,-6714],["Ponce",1799,-6661],["San Germán",1798,-6704],["San Juan",1847,-6611],["Trujillo Alto",1836,-6600],["Vega Baja",1845,-6639]]]]],["Romania","RO",[["","",[["Arad",4619,2131],["Bacău",4657,2693],["Baia Mare",4766,2358],["Brăila",4527,2796],["Brașov",4566,2560],["Bucharest",4443,2610],["Buzău",4515,2682],["Cluj-Napoca",4677,2362],["Constanța",4418,2863],["Craiova",4432,2380],["Focșani",4570,2718],["Galați",4543,2803],["Iași",4716,2759],["Oradea",4705,2192],["Pitești",4486,2487],["Ploiești",4494,2603],["Sibiu",4580,2415],["Târgu Jiu",4505,2327],["Târgu Mureș",4654,2456],["Timișoara",4575,2121]]]]],["Russia","RU",[["","",[["Chelyabinsk",5516,6144],["Kazan",5576,4912],["Khabarovsk",4846,13506],["Krasnoyarsk",5602,9289],["Moscow",5576,3762],["Nizhny Novgorod",5632,4401],["Novokuznetsk",5376,8711],["Novosibirsk",5501,8294],["Omsk",5499,7332],["Orenburg",5177,5510],["Perm",5859,5632],["Rostov-on-Don",4724,3970],["Saint Petersburg",5993,3034],["Samara",5341,5031],["Tyumen",5715,6554],["Ufa",5474,5597],["Vladivostok",4312,13188],["Volgograd",4871,4451],["Voronezh",5166,3920],["Yekaterinburg",5684,6061]]]]],["Samoa","WS",[["","",[["Afega",-1380,-17177],["Apia",-1384,-17174],["Faleaseela",-1376,-17220],["Falelima",-1345,-17233],["Falevao",-1398,-17180],["Fasitoouta",-1390,-17177],["Leulumoega",-1384,-17185],["Malie",-1382,-17182],["Manase",-1350,-17229],["Mulifanua",-1383,-17203],["Poutasi",-1399,-17187],["Sa'asa'ai",-1389,-17234],["Safotu",-1345,-17240],["Salelavalu",-1355,-17250],["Salepoua'e",-1362,-17248],["Satuiatua",-1364,-17257],["Solosolo",-1385,-17180],["Vailele",-1381,-17183],["Vaisala",-1369,-17230],["Vaitele",-1382,-17181]]]]],["Saudi Arabia","SA",[["","",[["Abha",1822,4251],["Al-Hofuf",2536,4957],["Al-Kharj",2416,4733],["Al-Qatif",2652,5004],["Arar",3098,4104],["Buraidah",2636,4397],["Dammam",2642,5009],["Hafr Al-Batin",2844,4596],["Hail",2752,4171],["Jeddah",2149,3919],["Jizan",1689,4256],["Jubail",2704,4951],["Khobar",2628,5021],["Mecca",2139,3986],["Medina",2452,3957],["Najran",1754,4422],["Riyadh",2471,4668],["Sakakah",2997,4021],["Tabuk",2838,3656],["Taif",2127,4042]]]]],["Senegal","SN",[["","",[["Dakar",1469,-1745],["Diourbel",1467,-1623],["Fatick",1435,-1641],["Guédiawaye",1474,-1743],["Kaffrine",1411,-1555],["Kaolack",1415,-1607],["Kédougou",1256,-1218],["Kolda",1287,-1495],["Koungheul",1398,-1380],["Louga",1561,-1623],["Matam",1566,-1326],["Mbour",1442,-1697],["Richard-Toll",1646,-1570],["Saint-Louis",1603,-1648],["Sédhiou",1271,-1556],["Tambacounda",1377,-1367],["Thiès",1479,-1696],["Tivaouane",1495,-1681],["Ziguinchor",1257,-1627]]]]],["Serbia","RS",[["","",[["Belgrade",4479,2046],["Cacak",4389,2035],["Kragujevac",4401,2092],["Kraljevo",4372,2069],["Kruševac",4358,2133],["Leskovac",4300,2195],["Niš",4332,2190],["Novi Pazar",4314,2052],["Novi Sad",4527,1983],["Pancevo",4487,2065],["Pirot",4315,2259],["Pozarevac",4462,2119],["Sabac",4475,1969],["Smederevo",4466,2093],["Sombor",4577,1912],["Subotica",4610,1967],["Uzice",4386,1984],["Valjevo",4427,1989],["Vranje",4255,2190],["Zrenjanin",4538,2037]]]]],["Singapore","SG",[["","",[["Ang Mo Kio",137,10385],["Bedok",132,10393],["Bukit Batok",135,10375],["Bukit Panjang",138,10377],["Bukit Timah",133,10379],["Choa Chu Kang",138,10374],["Clementi",132,10376],["Hougang",137,10389],["Jurong",132,10372],["Pasir Ris",138,10395],["Punggol",141,10390],["Queenstown",129,10381],["Sengkang",139,10390],["Serangoon",136,10387],["Singapore",135,10382],["Tampines",135,10394],["Toa Payoh",133,10386],["Woodlands",144,10379],["Yishun",143,10384]]]]],["Slovakia","SK",[["","",[["Banská Bystrica",4874,1916],["Bardejov",4929,2127],["Bratislava",4815,1711],["Humenné",4894,2192],["Komárno",4776,1812],["Košice",4872,2126],["Levice",4822,1862],["Martin",4907,1892],["Michalovce",4875,2192],["Nitra",4831,1808],["Nové Zámky",4799,1816],["Poprad",4906,2030],["Považská Bystrica",4907,1844],["Prešov",4900,2124],["Prievidza",4878,1863],["Spišská Nová Ves",4894,2099],["Trenčín",4890,1804],["Trnava",4837,1759],["Žilina",4922,1874],["Zvolen",4857,1913]]]]],["Slovenia","SI",[["","",[["Ajdovščina",4589,1391],["Celje",4624,1527],["Domžale",4614,1459],["Izola",4554,1366],["Jesenice",4643,1406],["Kamnik",4622,1461],["Koper",4555,1373],["Kranj",4624,1436],["Krško",4596,1549],["Ljubljana",4606,1451],["Maribor",4655,1565],["Murska Sobota",4666,1617],["Nova Gorica",4596,1364],["Novo Mesto",4580,1517],["Ptuj",4642,1587],["Škofja Loka",4617,1431],["Trbovlje",4616,1505],["Trebnje",4590,1502],["Velenje",4636,1511]]]]],["Somalia","SO",[["","",[["Baidoa",312,4365],["Beledweyne",474,4520],["Berbera",1044,4501],["Bosaso",1128,4918],["Bu'aale",108,4258],["Burco",952,4553],["Ceeldheer",474,4797],["Dhuusamarreeb",574,4651],["Erigavo",1062,4737],["Galkayo",678,4743],["Garowe",841,4848],["Hargeisa",956,4406],["Hudur",414,4389],["Jowhar",278,4550],["Kismayo",-36,4255],["Las Anod",866,4737],["Marka",178,4477],["Mogadishu",205,4532],["Oodweyne",950,4567]]]]],["South Africa","ZA",[["","",[["Bloemfontein",-2912,2621],["Cape Town",-3392,1842],["Durban",-2986,3102],["East London",-3298,2787],["George",-3396,2246],["Grahamstown",-3331,2652],["Johannesburg",-2620,2805],["Kimberley",-2874,2477],["Klerksdorp",-2685,2667],["Kroonstad",-2765,2723],["Middelburg",-2578,2946],["Nelspruit",-2547,3097],["Pietermaritzburg",-2959,3024],["Polokwane",-2390,2947],["Port Elizabeth",-3396,2560],["Pretoria",-2575,2819],["Rustenburg",-2567,2724],["Upington",-2846,2124],["Vryheid",-2777,3079],["Witbank",-2587,2923]]]]],["South Korea","KR",[["","",[["Andong",3657,12873],["Busan",3518,12908],["Changwon",3523,12868],["Cheongju",3664,12742],["Daegu",3587,12860],["Daejeon",3635,12738],["Gimhae",3523,12888],["Goyang",3766,12684],["Gwangju",3516,12685],["Gwangmyeong",3748,12687],["Iksan",3594,12695],["Incheon",3746,12671],["Jeju",3350,12653],["Jeonju",3582,12715],["Mokpo",3479,12639],["Pohang",3602,12937],["Seoul",3757,12698],["Suwon",3726,12703],["Ulsan",3554,12931],["Yeosu",3474,12774]]]]],["Spain","ES",[["","",[["Alicante",3835,-48],["Barcelona",4139,217],["Bilbao",4326,-293],["Córdoba",3789,-478],["Gijón",4353,-568],["Granada",3718,-360],["Hospitalet de Llobregat",4136,210],["La Coruña",4336,-841],["Las Palmas",2812,-1544],["Madrid",4042,-370],["Málaga",3672,-442],["Murcia",3798,-113],["Palma",3957,265],["Santa Cruz de Tenerife",2846,-1625],["Seville",3739,-598],["Valencia",3947,-38],["Valladolid",4165,-473],["Vigo",4223,-872],["Vitoria-Gasteiz",4286,-268],["Zaragoza",4165,-89]]]]],["Sri Lanka","LK",[["","",[["Anuradhapura",831,8040],["Badulla",699,8106],["Batticaloa",774,8170],["Chilaw",758,7980],["Colombo",693,7986],["Dehiwala-Mount Lavinia",685,7986],["Galle",604,8022],["Gampola",717,8056],["Hambantota",612,8112],["Jaffna",966,8003],["Kalmunai",741,8183],["Kalutara",658,7996],["Kandy",729,8063],["Matale",747,8062],["Matara",595,8056],["Moratuwa",677,7988],["Negombo",721,7984],["Nuwara Eliya",697,8078],["Ratnapura",671,8038],["Vavuniya",875,8050]]]]],["Sweden","SE",[["","",[["Borås",5772,1294],["Eskilstuna",5937,1651],["Gävle",6067,1714],["Gothenburg",5771,1197],["Halmstad",5667,1286],["Helsingborg",5605,1269],["Karlstad",5938,1350],["Linköping",5841,1562],["Luleå",6558,2216],["Lund",5570,1319],["Malmö",5560,1300],["Mölndal",5765,1201],["Norrköping",5859,1619],["Örebro",5927,1521],["Stockholm",5933,1807],["Sundsvall",6239,1731],["Umeå",6383,2026],["Uppsala",5986,1764],["Västerås",5961,1655],["Växjö",5688,1481]]]]],["Switzerland","CH",[["","",[["Basel",4756,759],["Bern",4695,745],["Biel/Bienne",4714,725],["Emmen",4708,831],["Fribourg",4681,716],["Geneva",4620,614],["Köniz",4693,740],["Kriens",4703,828],["La Chaux-de-Fonds",4710,683],["Lancy",4619,613],["Lausanne",4652,663],["Lucerne",4705,831],["Lugano",4601,894],["Neuchâtel",4699,693],["Schaffhausen",4770,863],["Sion",4623,736],["St. Gallen",4742,938],["Thun",4675,763],["Vernier",4622,608],["Zurich",4738,854]]]]],["Syria","SY",[["","",[["Al-Qusayr",3450,3628],["Aleppo",3620,3713],["As-Suwayda",3270,3657],["Damascus",3351,3628],["Darayya",3346,3625],["Deir ez-Zor",3532,4017],["Hama",3513,3676],["Homs",3473,3671],["Idlib",3593,3663],["Latakia",3553,3578],["Ma'arrat al-Nu'man",3563,3662],["Manbij",3653,3796],["Masyaf",3504,3633],["Qamishli",3704,4122],["Raqqa",3596,3901],["Salamiyah",3502,3705],["Salqin",3613,3653],["Tadmur",3455,3828],["Tartus",3488,3589],["Yabrud",3397,3666]]]]],["Taiwan","TW",[["","",[["Changhua",2407,12054],["Chiayi",2348,12044],["Hsinchu",2481,12097],["Hualien",2398,12161],["Kaohsiung",2263,12027],["Keelung",2513,12174],["Kinmen",2443,11832],["Lienchiang",2616,11994],["Miaoli",2456,12082],["Nantou",2396,12097],["New Taipei",2502,12145],["Penghu",2357,11958],["Pingtung",2266,12048],["Taichung",2415,12067],["Tainan",2300,12020],["Taipei",2503,12157],["Taitung",2276,12114],["Taoyuan",2499,12130],["Yilan",2476,12175],["Yunlin",2370,12054]]]]],["Thailand","TH",[["","",[["Bangkok",1376,10050],["Chiang Mai",1879,9899],["Chon Buri",1336,10098],["Hua Hin",1257,9996],["Khon Kaen",1644,10282],["Lampang",1829,9949],["Nakhon Pathom",1382,10004],["Nakhon Ratchasima",1498,10210],["Nakhon Sawan",1570,10013],["Nonthaburi",1386,10052],["Pattaya",1292,10088],["Phitsanulok",1682,10027],["Phra Nakhon Si Ayutthaya",1436,10056],["Phra Pradaeng",1366,10053],["Phuket",788,9839],["Rayong",1268,10126],["Songkhla",719,10060],["Surat Thani",913,9933],["Trang",756,9961],["Udon Thani",1742,10278]]]]],["Trinidad and Tobago","TT",[["","",[["Arima",1063,-6128],["Chaguanas",1052,-6141],["Chaguaramas",1067,-6163],["Couva",1042,-6142],["Diego Martin",1072,-6157],["Guaico",1059,-6101],["La Brea",1021,-6146],["Mayaro",1032,-6118],["Point Fortin",1018,-6168],["Port of Spain",1065,-6151],["Princes Town",1027,-6137],["Rio Claro",1030,-6111],["San Fernando",1028,-6147],["Sangre Grande",1058,-6113],["Scarborough",1118,-6073],["Siparia",1013,-6152],["Tobago",1125,-6067],["Toco",1083,-6097],["Tunapuna",1065,-6138]]]]],["Tunisia","TN",[["","",[["Béja",3673,919],["Bizerte",3727,987],["Douz",3346,902],["Gabès",3388,1010],["Gafsa",3442,878],["Jendouba",3651,878],["Kairouan",3567,1010],["Kasserine",3517,884],["Kébili",3370,897],["Mahdia",3550,1104],["Monastir",3577,1083],["Nabeul",3646,1074],["Sfax",3474,1076],["Sidi Bouzid",3504,948],["Siliana",3608,937],["Sousse",3583,1064],["Tataouine",3293,1045],["Tozeur",3393,813],["Tunis",3681,1018],["Zarzis",3351,1110]]]]],["Turkey","TR",[["","",[["Adana",3700,3532],["Ankara",3993,3286],["Antalya",3690,3069],["Bursa",4018,2907],["Corum",4055,3496],["Denizli",3777,2909],["Diyarbakir",3791,4023],["Erdemli",3661,3431],["Eskisehir",3977,3053],["Gaziantep",3707,3738],["Hatay",3640,3635],["Istanbul",4101,2898],["Izmir",3842,2713],["Kayseri",3873,3548],["Konya",3787,3248],["Manisa",3862,2743],["Mersin",3680,3463],["Mugla",3722,2836],["Samsun",4129,3633],["Trabzon",4101,3973]]]]],["Uganda","UG",[["","",[["Arua",302,3091],["Busia",45,3408],["Entebbe",6,3246],["Fort Portal",68,3025],["Gulu",277,3231],["Hoima",144,3134],["Jinja",42,3320],["Kampala",31,3258],["Kasese",23,2999],["Lira",223,3291],["Lugazi",38,3293],["Masaka",-31,3171],["Masindi",167,3172],["Mbale",106,3418],["Mbarara",-60,3068],["Moroto",253,3466],["Mubende",59,3137],["Nebbi",247,3110],["Tororo",70,3418],["Yumbe",346,3125]]]]],["Ukraine","UA",[["","",[["Cherkasy",4944,3206],["Chernihiv",5150,3129],["Dnipro",4846,3505],["Kharkiv",4999,3623],["Kherson",4664,3262],["Krivoy Rog",4790,3338],["Kropyvnytskyi",4851,3226],["Kyiv",5045,3052],["Luhansk",4857,3931],["Lviv",4984,2403],["Makiivka",4804,3797],["Mariupol",4710,3754],["Nikolaev",4697,3201],["Odessa",4648,3072],["Poltava",4959,3454],["Simferopol",4495,3410],["Sumy",5091,3480],["Vinnytsia",4923,2848],["Zaporizhia",4784,3514],["Zhytomyr",5025,2866]]]]],["United Kingdom","UK",[["","",[["Belfast",5460,-593],["Birmingham",5249,-189],["Bradford",5379,-175],["Bristol",5145,-259],["Cardiff",5148,-318],["Coventry",5241,-152],["Edinburgh",5595,-319],["Glasgow",5586,-425],["Leeds",5380,-155],["Leicester",5264,-114],["Liverpool",5341,-299],["London",5151,-13],["Manchester",5348,-224],["Newcastle upon Tyne",5498,-162],["Nottingham",5295,-115],["Sheffield",5338,-147],["Wakefield",5368,-150]]]]],["United States","US",[["Alabama","AL",[["Auburn",326100,-854800],["Birmingham",3352,-8681],["Huntsville",3473,-8659],["Mobile",3069,-8804],["Montgomery",3238,-8631],["Tuscaloosa",3321,-8756]]],["Alaska","AK",[["Anchorage",6122,-14989],["Fairbanks",6484,-14772],["Juneau",5830,-13441],["Ketchikan",5534,-13165],["Sitka",5705,-13533]]],["Arizona","AZ",[["Chandler",3331,-11184],["Mesa",3342,-11182],["Phoenix",3345,-11207],["Scottsdale",3350,-11192],["Tucson",3222,-11097]]],["Arkansas","AR",[["Fayetteville",3606,-9416],["Fort Smith",3539,-9441],["Jonesboro",3584,-9069],["Little Rock",3474,-9227],["Springdale",3619,-9413]]],["California","CA",[["Anaheim",3384,-11791],["Bakersfield",3537,-11902],["Fresno",3675,-11977],["Long Beach",3377,-11819],["Los Angeles",3405,-11824],["Oakland",3780,-12227],["Sacramento",3858,-12149],["San Diego",3272,-11716],["San Francisco",3777,-12242],["San Jose",3734,-12189]]],["Colorado","CO",[["Aurora",3973,-10482],["Boulder",400100,-105300],["Colorado Springs",3883,-10482],["Denver",3974,-10499],["Fort Collins",4059,-10508],["Lakewood",3970,-10508]]],["Connecticut","CT",[["Bridgeport",4117,-7319],["Hartford",4176,-7268],["New Haven",4131,-7292],["Stamford",4106,-7354],["Storrs",418000,-722500],["Waterbury",4156,-7305]]],["Delaware","DE",[["Dover",3916,-7553],["Middletown",3945,-7571],["Newark",3968,-7575],["Smyrna",3930,-7561],["Wilmington",3974,-7554]]],["District of Columbia","DC",[["Washington",3890,-7704]]],["Florida","FL",[["Gainesville",296700,-823400],["Jacksonville",3033,-8166],["Miami",2576,-8019],["Orlando",2854,-8138],["St. Petersburg",2777,-8267],["Tallahassee",304400,-842800],["Tampa",2795,-8247]]],["Georgia","GA",[["Atlanta",3375,-8439],["Augusta",3347,-8197],["Columbus",3247,-8498],["Macon",3284,-8363],["Oxford",336200,-838600],["Savannah",3208,-8110]]],["Hawaii","HI",[["Hilo",1971,-15508],["Honolulu",2131,-15786],["Kailua",2139,-15774],["Kapolei",2133,-15809],["Pearl City",2141,-15797]]],["Idaho","ID",[["Boise",4362,-11621],["Idaho Falls",4349,-11204],["Meridian",4361,-11639],["Moscow",468400,-1170000],["Nampa",4358,-11657],["Pocatello",4287,-11245]]],["Illinois","IL",[["Aurora",4176,-8820],["Chicago",4187,-8762],["Joliet",4153,-8812],["Naperville",4175,-8815],["Rockford",4227,-8910]]],["Indiana","IN",[["Evansville",3797,-8756],["Fort Wayne",4108,-8514],["Hammond",4161,-8749],["Indianapolis",3977,-8615],["South Bend",4168,-8625]]],["Iowa","IA",[["Cedar Rapids",4198,-9166],["Davenport",4153,-9058],["Des Moines",4159,-9362],["Iowa City",4166,-9154],["Sioux City",4250,-9640]]],["Kansas","KS",[["Kansas City",3911,-9463],["Olathe",3888,-9482],["Overland Park",3898,-9467],["Topeka",3905,-9568],["Wichita",3769,-9734]]],["Kentucky","KY",[["Bowling Green",3699,-8644],["Covington",3909,-8451],["Lexington",3803,-8450],["Louisville",3825,-8576],["Owensboro",3777,-8711]]],["Louisiana","LA",[["Baton Rouge",3045,-9115],["Lafayette",3022,-9201],["Lake Charles",3021,-9321],["New Orleans",2995,-9008],["Shreveport",3252,-9377]]],["Maine","ME",[["Auburn",4409,-7022],["Bangor",4480,-6877],["Lewiston",4410,-7021],["Portland",4366,-7025]]],["Maryland","MD",[["Baltimore",3929,-7661],["College Park",389900,-769300],["Columbia",3921,-7686],["Frederick",3942,-7742],["Germantown",3918,-7726],["Silver Spring",3899,-7703]]],["Massachusetts","MA",[["Boston",4236,-7106],["Cambridge",4237,-7110],["Lowell",4264,-7132],["Springfield",4210,-7259],["Worcester",4226,-7180]]],["Michigan","MI",[["Ann Arbor",4228,-8374],["Detroit",4233,-8305],["Grand Rapids",4296,-8567],["Sterling Heights",4258,-8303],["Warren",4249,-8303]]],["Minnesota","MN",[["Bloomington",4482,-9331],["Duluth",4678,-9210],["Minneapolis",4497,-9326],["Rochester",4402,-9247],["St. Paul",4495,-9310]]],["Mississippi","MS",[["Biloxi",3040,-8889],["Gulfport",3037,-8909],["Hattiesburg",3132,-8929],["Jackson",3230,-9018],["Southaven",3497,-9001]]],["Missouri","MO",[["Columbia",3895,-9233],["Independence",3907,-9441],["Kansas City",3910,-9458],["Springfield",3721,-9329],["St. Louis",3863,-9020]]],["Montana","MT",[["Billings",4579,-10850],["Bozeman",4568,-11105],["Butte",4599,-11253],["Missoula",4687,-11401],["Poor Falls",4751,-11130]]],["Nebraska","NE",[["Bellevue",4115,-9592],["Grand Island",4092,-9834],["Kearney",4070,-9908],["Lincoln",4081,-9668],["Omaha",4126,-9601]]],["Nevada","NV",[["Henderson",3604,-11503],["Las Vegas",3617,-11514],["Reno",3953,-11981],["Sparks",3953,-11975]]],["New Hampshire","NH",[["Concord",4321,-7154],["Derry",4289,-7130],["Manchester",4299,-7146],["Nashua",4276,-7147],["Rochester",4330,-7098]]],["New Jersey","NJ",[["Edison",4052,-7441],["Elizabeth",4066,-7421],["Jersey City",4073,-7407],["Newark",4073,-7417],["Paterson",4092,-7416],["South Orange",406500,-741300]]],["New Mexico","NM",[["Albuquerque",3508,-10665],["Las Cruces",3232,-10676],["Rio Rancho",3529,-10670],["Roswell",3339,-10452],["Santa Fe",3568,-10594]]],["New York","NY",[["Brooklyn",4068,-7394],["Buffalo",4289,-7888],["New York City",4071,-7401],["Queens",407100,-738700],["Rochester",4316,-7761],["Syracuse",4305,-7615],["Yonkers",4094,-7387]]],["North Carolina","NC",[["Chapel Hill",359300,-790600],["Charlotte",3523,-8084],["Durham",3599,-7890],["Greensboro",3607,-7979],["Raleigh",3578,-7864],["Winston-Salem",3610,-8026]]],["North Dakota","ND",[["Bismarck",4681,-10078],["Fargo",4688,-9679],["Grand Forks",4792,-9707],["Minot",4823,-10130],["West Fargo",4687,-9690]]],["Ohio","OH",[["Akron",4108,-8152],["Cincinnati",3910,-8451],["Cleveland",4150,-8169],["Columbus",3998,-8299],["Toledo",4166,-8358]]],["Oklahoma","OK",[["Broken Arrow",3605,-9579],["Lawton",3461,-9839],["Norman",3522,-9744],["Oklahoma City",3547,-9752],["Tulsa",3615,-9599]]],["Oregon","OR",[["Corvallis",443500,-1232700],["Eugene",4406,-12311],["Gresham",4550,-12243],["Hillsboro",4552,-12299],["Portland",4552,-12268],["Salem",4494,-12304]]],["Pennsylvania","PA",[["Allentown",4060,-7547],["Erie",4212,-8009],["Philadelphia",3995,-7516],["Pittsburgh",4044,-7999],["Reading",4034,-7593],["Tempe",401100,-752100],["Villanova",400400,-752300]]],["Rhode Island","RI",[["Cranston",4178,-7147],["East Providence",4181,-7135],["Pawtucket",4187,-7138],["Providence",4182,-7142],["South Kingstown",414600,-714900],["Warwick",4171,-7142]]],["South Carolina","SC",[["Charleston",3278,-7993],["Columbia",3404,-8090],["Mount Pleasant",3280,-7989],["North Charleston",3288,-8002],["Rock Hill",3493,-8103]]],["South Dakota","SD",[["Aberdeen",4547,-9848],["Brookings",4431,-9679],["Rapid City",4408,-10323],["Sioux Falls",4355,-9673],["Watertown",4490,-9712]]],["Tennessee","TN",[["Chattanooga",3505,-8531],["Clarksville",3653,-8736],["Knoxville",3596,-8392],["Memphis",3515,-9005],["Nashville",3616,-8678]]],["Texas","TX",[["Austin",3027,-9774],["College Station",306200,-963400],["Dallas",3278,-9680],["Fort Worth",3275,-9733],["Houston",2976,-9537],["Lubbock",335800,-1018800],["San Antonio",2942,-9849],["Waco",315400,-971500]]],["Utah","UT",[["Logan",417400,-1118400],["Ogden",412200,-1119700],["Orem",4029,-11170],["Provo",4024,-11166],["Salt Lake City",4076,-11189],["Sandy",4057,-11186],["West Valley City",4069,-11200]]],["Vermont","VT",[["Barre",4419,-7250],["Burlington",4448,-7322],["Montpelier",4426,-7257],["Rutland",4361,-7297],["South Burlington",4447,-7322]]],["Virginia","VA",[["Arlington",3888,-7711],["Charlottesville",380300,-784800],["Chesapeake",3676,-7629],["Norfolk",3685,-7629],["Richmond",3754,-7743],["Virginia Beach",3685,-7598]]],["Washington","WA",[["Bellevue",4761,-12220],["Pullman",467300,-1171600],["Seattle",4761,-12233],["Spokane",4766,-11743],["Tacoma",4725,-12244],["Vancouver",4563,-12265]]],["West Virginia","WV",[["Charleston",3835,-8164],["Huntington",3842,-8244],["Morgantown",3963,-7995],["Parkersburg",3927,-8156],["Wheeling",4007,-8072]]],["Wisconsin","WI",[["Green Bay",4452,-8802],["Kenosha",4258,-8786],["Madison",4307,-8938],["Milwaukee",4304,-8791],["Racine",4273,-8778]]],["Wyoming","WY",[["Casper",4286,-10631],["Cheyenne",4114,-10482],["Gillette",4429,-10550],["Laramie",4131,-10559],["Rock Springs",4159,-10920]]]]],["Uruguay","UY",[["","",[["Artigas",-3042,-5647],["Canelones",-3452,-5628],["Colonia del Sacramento",-3448,-5784],["Colonia Nicolich",-3482,-5605],["Durazno",-3338,-5650],["Florida",-3410,-5621],["Las Piedras",-3473,-5622],["Maldonado",-3491,-5496],["Meló",-3236,-5417],["Mercedes",-3326,-5802],["Minas",-3437,-5524],["Montevideo",-3490,-5616],["Pando",-3472,-5596],["Paysandú",-3232,-5808],["Rivera",-3091,-5555],["Rocha",-3448,-5433],["Salto",-3138,-5796],["San José de Mayo",-3435,-5671],["Tacuarembó",-3173,-5598],["Treinta y Tres",-3323,-5438]]]]],["Uzbekistan","UZ",[["","",[["Andijan",4079,7234],["Angren",4102,7017],["Bukhara",3978,6443],["Chirchiq",4146,6956],["Fergana",4038,7178],["Jizzakh",4012,6784],["Kokand",4053,7094],["Namangan",4100,7167],["Navoiy",4008,6538],["Nukus",4246,5962],["Qarshi",3886,6580],["Samarkand",3963,6697],["Tashkent",4130,6924],["Termiz",3722,6728],["Urgench",4155,6063]]]]],["Venezuela","VE",[["","",[["Barcelona",1014,-6468],["Barquisimeto",1007,-6932],["Caracas",1048,-6690],["Ciudad Guayana",831,-6273],["Cumana",1045,-6418],["Guarenas",1047,-6661],["La Guaira",1060,-6693],["La Victoria",1024,-6797],["Los Teques",1034,-6704],["Maracaibo",1065,-7162],["Maracay",1024,-6759],["Maturín",975,-6318],["Ocumare del Tuy",1012,-6678],["Puerto Cabello",1046,-6801],["Punto Fijo",1170,-7018],["San Antonio de los Altos",1038,-6695],["San Cristóbal",777,-7222],["San Fernando",791,-6748],["Valencia",1018,-6800]]]]],["Vietnam","VN",[["","",[["Bien Hoa",1095,10681],["Buon Ma Thuot",1267,10804],["Cam Ranh",1191,10916],["Da Lat",1194,10846],["Da Nang",1605,10820],["Ha Long",2095,10708],["Ha Tinh",1833,10590],["Haiphong",2086,10668],["Hanoi",2103,10585],["Ho Chi Minh City",1078,10670],["Hue",1646,10759],["Long Xuyen",1038,10542],["Nha Trang",1224,10920],["Qui Nhon",1378,10922],["Rach Gia",1002,10508],["Sa Dec",1030,10545],["Sa Pa",2234,10384],["Thai Nguyen",2159,10584],["Vung Tau",1035,10708]]]]]];
const protectedKeys=new Set(['roster','staff','announcers','coaches','commissioner','referees','media','draftClass','freeAgents','threePointContestants','retirees','hallOfFame','contractOffers','records','career','currentGame','history','headToHeads','inbox','startingLineup','currentLineup','lineupPreset','draftPicks','scoringOptions','quickPlays','championships','workshop']);
const hiddenState=new Set(['news','draftWorkouts','schedule','tradeOffers','playoffs','posts','playerHistory']);
const LEAGUE_RETIRED_NUMBERS_KEY='__hoopLeagueStudioRetiredNumbers';
const label=k=>k==='playoffTeams'&&league?.leagueType===1?'Tournament Teams':({meta:'Countries',gender:'League Gender',sliders:'Game Style Sliders',season:'Season Settings',optimization:'Save Data Optimization',progressionRate:'XP Progression Rate',ageAppearance:'Appearance Aging',cpuTrading:'CPU Trading',hidePotential:'Hide Player Potential',HOFbar:'Hall of Fame Eligibility',cpuRosterChanges:'CPU Roster Changes',cpuTradeBlock:'CPU Auto Trade Block',cpuProgression:'CPU Auto Progression',overrideCPU:'Override CPU Decisions',seriesLength:'Round Length',simulationPreset:'Simulation Preset',dunkAccuracy:'Dunk Distance',insideAccuracy:'Inside Shot Accuracy',midrangeAccuracy:'Midrange Shot Accuracy',threePointAccuracy:'3PT Shot Accuracy',fatigueStrength:'Fatigue Effect Strength',playerVSCPUAccuracy:'Player vs CPU Shot Accuracy',shootingFouls:'Shooting Fouls',offFouls:'Offensive Fouls',bonus:'Bonus Situation',foulOut:'Foul Out',oneAndOne:'1-and-1 Free Throw',backcourt:'Backcourt / Eight Seconds',defGoaltending:'Defensive Goaltending',offGoaltending:'Offensive Goaltending',offThreeSeconds:'Offensive Three Seconds',gameLength:'Game Length (Minutes)',totalPeriods:'Total Periods',shotClock:'Shot Clock (Seconds)',difficulty:'Game Difficulty',rules:'Game Rules',gameStyle:'Game Style',CPUShotTiming:'CPU Shot Timing',CPUPlayerSpeed:'CPU Player Speed',CPUReactionTime:'CPU Defensive Strength',LAY:'LAYUP',DNK:'DUNK',INS:'INSIDE',MID:'MIDRANGE',TPT:'THREE POINT',FTS:'FREE THROW',DRB:'DRIBBLING',PAS:'PASSING',ORE:'OFFENSIVE REBOUNDING',DRE:'DEFENSIVE REBOUNDING',STL:'STEAL',BLK:'BLOCK',STR:'STRENGTH',SPD:'SPEED',STM:'STAMINA',pg:'PG',sg:'SG',sf:'SF',pf:'PF',c:'C'}[k]||String(k).replace(/URL/g,' URL').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,c=>c.toUpperCase()));
const get=p=>p.reduce((o,k)=>o[k],league);
function adaptDefaultAwards(data,type=data.leagueType){
 if(![0,1].includes(type))return false;
 const pairs=[
  [{name:'Champion',shortName:'CHAMP',spriteName:'championship'},{name:'National Championship',shortName:'NATTY',spriteName:'natty'}],
  [{name:'Finals MVP',shortName:'FMVP',spriteName:'fmvp'},{name:'Most Outstanding Player',shortName:'MOP',spriteName:'mop'}],
  [{name:'Most Valuable Player',shortName:'MVP',spriteName:'mvp'},{name:'Player of the Year',shortName:'POTY',spriteName:'poty'}],
  [{name:'Rookie of the Year',shortName:'ROTY',spriteName:'roty'},{name:'Freshman of the Year',shortName:'FOTY',spriteName:'roty'}]
 ];
 let changed=false;
 // Upgrade the original college defaults only when all nine slots are still unused.
 // A partially customized set (including removed awards) keeps its existing slots.
 const extraDefaults=standaloneSample.awards.filter(award=>award.id>=3&&award.id<=11);
 if(type===1&&extraDefaults.every(defaultAward=>{
  const slot=data.awards?.find(award=>award.id===defaultAward.id);
  return slot&&isEmptyAward(slot);
 })){
  for(const defaultAward of extraDefaults){const index=data.awards.findIndex(award=>award.id===defaultAward.id);data.awards[index]=structuredClone(defaultAward)}
  changed=true;
 }
 for(const award of data.awards||[]){
  const pair=pairs.find(pair=>award.name===pair[1-type].name&&award.spriteName===pair[1-type].spriteName);
  if(!pair)continue;
  const [source,target]=[pair[1-type],pair[type]];
  award.name=target.name;award.spriteName=target.spriteName;
  if(award.shortName===source.shortName)award.shortName=target.shortName;
  changed=true;
 }
 return changed;
}
function applySettingPreset(data,p,v){
 const difficulty=[
 {shotSpeed:0,shotStyle:0,CPUShotTiming:0,CPUReactionTime:0,CPUPlayerSpeed:0},
 {shotSpeed:0,shotStyle:0,CPUShotTiming:1,CPUReactionTime:1,CPUPlayerSpeed:1},
 {shotSpeed:1,shotStyle:1,CPUShotTiming:2,CPUReactionTime:2,CPUPlayerSpeed:1}];
 const styles=[
 {layupAccuracy:100,dunkAccuracy:60,insideAccuracy:70,midrangeAccuracy:70,threePointAccuracy:70,freeThrowAccuracy:50,stealSuccessRate:70,blockSuccessRate:70,contestedShotStrength:50,fatigueStrength:100,homeCourtAdvantage:50,playerVSCPUAccuracy:0},
 {layupAccuracy:100,dunkAccuracy:100,insideAccuracy:100,midrangeAccuracy:100,threePointAccuracy:100,freeThrowAccuracy:100,stealSuccessRate:70,blockSuccessRate:100,contestedShotStrength:0,fatigueStrength:0,homeCourtAdvantage:50,playerVSCPUAccuracy:0}];
 if(p.length===1&&p[0]==='leagueType'&&[0,1].includes(v)){adaptDefaultAwards(data,v);data.settings||={};data.settings.rules=v;if(v===1){data.settings.gameLength=3;data.settings.totalPeriods=0;data.settings.shotClock=2}else{data.settings.gameLength=4;data.settings.totalPeriods=1;data.settings.shotClock=1}return applySettingPreset(data,['settings','rules'],v)}
 if(p.length!==2)return false;
 if(p[0]==='season'&&p[1]==='simulationPreset'&&[0,1].includes(v)){data.simulationSliders||={};const defaults={"layupAccuracy":100,"dunkAccuracy":100,"insideAccuracy":100,"midrangeAccuracy":100,"threePointAccuracy":100,"freeThrowAccuracy":80,"contestedShotStrength":100,"stealSuccessRate":50,"blockSuccessRate":75,"fatigueStrength":100,"homeCourtAdvantage":100,"shootingFoulFrequency":50};Object.assign(data.simulationSliders,v===0?defaults:Object.fromEntries(Object.keys(data.simulationSliders).map(k=>[k,50])));return true}
 if(p[0]==='optimization'){data.season||={};data.season.optimization=2;return true}
 if(p[0]==='simulationSliders'){data.season||={};data.season.simulationPreset=1;return true}
 if(p[0]==='season'&&p[1]==='optimization'&&[0,1].includes(v)){const target=data.optimization||(data.optimization={});for(const key of ['teamLogos','courts','tableGraphics','disableBoxScores'])target[key]=v===1;return true}
 if(p[0]==='settings'){
  let target,preset;
  if(p[1]==='difficulty'){target='difficulty';preset=difficulty[v]}
  if(p[1]==='gameStyle'){target='sliders';preset=v===2?Object.fromEntries(Object.keys(data.sliders||styles[0]).map(k=>[k,50])):styles[v]}
  if(p[1]==='rules'&&[0,1].includes(v)){target='rules';preset={shootingFouls:2,offFouls:2,bonus:v===1?2:0,oneAndOne:v===1,foulOut:v===1?1:2,backcourt:true,defGoaltending:true,offGoaltending:true,offThreeSeconds:true}}
  if(preset){const dest=data[target]||(data[target]={});for(const [k,value]of Object.entries(preset))dest[k]=typeof value==='boolean'&&typeof dest[k]==='number'?Number(value):value;return true}
 }
 const custom={difficulty:['difficulty',3],rules:['rules',2],sliders:['gameStyle',2]}[p[0]];
 if(custom&&data.settings){data.settings[custom[0]]=custom[1];return true}
 return false;
}
function inferImportedSliderPresets(data){
 if(!data||typeof data!=='object')return data;

 const gameStyles=[
  {
   layupAccuracy:100,dunkAccuracy:60,insideAccuracy:70,midrangeAccuracy:70,
   threePointAccuracy:70,freeThrowAccuracy:50,contestedShotStrength:50,
   stealSuccessRate:70,blockSuccessRate:70,fatigueStrength:100,
   homeCourtAdvantage:50,playerVSCPUAccuracy:0,shootingFoulFrequency:50
  },
  {
   layupAccuracy:100,dunkAccuracy:100,insideAccuracy:100,midrangeAccuracy:100,
   threePointAccuracy:100,freeThrowAccuracy:100,contestedShotStrength:0,
   stealSuccessRate:70,blockSuccessRate:100,fatigueStrength:0,
   homeCourtAdvantage:50,playerVSCPUAccuracy:0,shootingFoulFrequency:50
  }
 ];
 const simulationDefault={
  layupAccuracy:100,dunkAccuracy:100,insideAccuracy:100,midrangeAccuracy:100,
  threePointAccuracy:100,freeThrowAccuracy:80,contestedShotStrength:100,
  stealSuccessRate:50,blockSuccessRate:75,fatigueStrength:100,
  homeCourtAdvantage:100,playerVSCPUAccuracy:50,shootingFoulFrequency:50
 };
 const matches=(values,preset)=>values&&Object.entries(preset).every(([key,value])=>Number(values[key])===value);

 if(data.sliders&&typeof data.sliders==='object'){
  data.settings||={};
  data.settings.gameStyle=matches(data.sliders,gameStyles[0])?0:matches(data.sliders,gameStyles[1])?1:2;
 }
 if(data.simulationSliders&&typeof data.simulationSliders==='object'){
  data.season||={};
  data.season.simulationPreset=matches(data.simulationSliders,simulationDefault)?0:1;
 }
 return data;
}
function syncSettingFields(){
 for(const input of document.querySelectorAll('[data-path]')){
  const path=JSON.parse(input.dataset.path);if(!['settings','difficulty','rules','sliders','simulationSliders','season','optimization'].includes(path[0]))continue;
  const value=get(path);if(input.syncValue){input.syncValue();continue}if(input.type==='checkbox')input.checked=value;else input.value=String(typeof value==='boolean'?Number(value):value);
 }
}
const lotteryModes=new WeakMap();
function lotteryMode(data){
 if(!lotteryModes.has(data))lotteryModes.set(data,{teams:false,odds:false});
 return lotteryModes.get(data);
}
function weightedLotteryOdds(count){
 count=Math.max(0,Math.min(64,Math.floor(Number(count)||0)));
 const total=count*(count+1)/2;
 const shares=Array.from({length:count},(_,i)=>1000*(count-i)/total);
 const odds=shares.map(Math.floor);
 const order=shares.map((value,i)=>({i,remainder:value-odds[i]})).sort((a,b)=>b.remainder-a.remainder||a.i-b.i);
 for(let left=1000-odds.reduce((sum,value)=>sum+value,0),i=0;i<left&&i<order.length;i++)odds[order[i].i]++;
 return odds;
}
function applyLotteryDefaults(data){
 if(data.leagueType!==0||!data.season)return;
 const mode=lotteryMode(data),season=data.season;
 if(mode.teams)season.lotteryTeams=Math.max(0,data.teams.length-Math.max(0,Math.floor(Number(season.playoffTeams)||0)));
 if(mode.odds)season.lotteryOdds=weightedLotteryOdds(season.lotteryTeams);
}
function updateLotterySetting(path,value){
 const mode=lotteryMode(league);
 if(path[0]==='season'&&path[1]==='lotteryTeams'){
  mode.teams=false;
  league.season.lotteryTeams=Math.max(0,Math.min(league.teams.length,Math.floor(Number(value)||0)));
 }
 if(path[0]==='season'&&path[1]==='lotteryOdds')mode.odds=false;
 if(path[0]==='leagueType'||path[0]==='season'&&['lotteryTeams','playoffTeams'].includes(path[1]))applyLotteryDefaults(league);
 for(const node of document.querySelectorAll('[data-lottery-controls]'))node.syncLottery();
 if(path[0]==='leagueType'||path[0]==='season'&&['lotteryTeams','playoffTeams'].includes(path[1])){
  for(const node of document.querySelectorAll('[data-lottery-odds]'))node.syncOdds();
  syncSettingFields();
 }
}
function scheduleDefaults(totalGames){
 const games=Number(totalGames);
 if(games>=91)return {divisionGames:5,conferenceGames:5,nonConferenceGames:2};
 if(games>=87)return {divisionGames:5,conferenceGames:4,nonConferenceGames:2};
 if(games>=83)return {divisionGames:4,conferenceGames:4,nonConferenceGames:2};
 if(games>=82)return {divisionGames:3,conferenceGames:4,nonConferenceGames:2};
 if(games>=72)return {divisionGames:3,conferenceGames:3,nonConferenceGames:2};
 if(games>=62)return {divisionGames:3,conferenceGames:3,nonConferenceGames:1};
 if(games>=52)return {divisionGames:3,conferenceGames:2,nonConferenceGames:1};
 if(games>=42)return {divisionGames:2,conferenceGames:2,nonConferenceGames:1};
 if(games>=30)return {divisionGames:2,conferenceGames:1,nonConferenceGames:1};
 return {divisionGames:1,conferenceGames:1,nonConferenceGames:1};
}
function applyScheduleDefaults(data,totalGames=29){
 if(!data?.season)return;
 data.season.totalGames=Number.isFinite(Number(totalGames))?Number(totalGames):29;
 const roundRobin=data.leagueType===1&&data.season.totalGames===data.teams?.length-1;
 Object.assign(data.season,roundRobin?{divisionGames:1,conferenceGames:1,nonConferenceGames:1}:scheduleDefaults(data.season.totalGames));
}

function expansionPersonIds(data=league){
 const ids=new Set(),add=person=>{const id=Number(person?.id);if(Number.isInteger(id)&&id>0)ids.add(id)},addGroup=group=>{if(Array.isArray(group))for(const person of group)add(person);else if(group&&typeof group==='object')add(group)};
 for(const collection of ['teams','starTeams'])for(const team of data?.[collection]||[]){addGroup(team?.roster);addGroup(team?.frontOffice?.staff);addGroup(team?.frontOffice?.announcers)}
 for(const key of ['staff','announcers','coaches','commissioner','referees','media','draftClass','freeAgents','retirees','hallOfFame'])addGroup(data?.[key]);
 return ids;
}
function expansionPersonIdAllocator(data=league){
 const used=expansionPersonIds(data);let cursor=Math.max(Number(data?.meta?.uPID)||0,...used,0);data.meta||={};
 return ()=>{do{cursor++}while(used.has(cursor));used.add(cursor);data.meta.uPID=cursor;return cursor};
}
let generationAssetsPromise;
async function loadGenerationAssets(){
 if(!generationAssetsPromise)generationAssetsPromise=Promise.all(['generation-prototype','team-generation-blueprints','player-blueprint','generation-appearance','generation-skills','league-defaults'].map(async name=>{
  const response=await fetch('./data/'+name+'.json');if(!response.ok)throw Error('Could not load league generation data. Please try again.');return response.json();
 })).catch(error=>{generationAssetsPromise=null;throw error});
 return generationAssetsPromise;
}
async function generateNewLeague(type,gender){
 const assets=await loadGenerationAssets();
 const source=structuredClone(assets[5][type===1?'college':'pro']);
 applyScheduleDefaults(source,type===1?31:29);applySettingPreset(source,['leagueType'],type);
 applySettingPreset(source,['settings','gameStyle'],source.settings.gameStyle);
 applySettingPreset(source,['season','simulationPreset'],source.season.simulationPreset);
 const [data,blueprints,player,appearance,skillCatalog]=assets;
 const seed=crypto.getRandomValues(new Uint32Array(1))[0];
 const next=window.HLSTeamGenerator.createLeague(source,data,blueprints,player,appearance,{seed,gender,skillCatalog});
 next.leagueName='My League';next.shortName='ML';next.meta.saveName='My League';
 lotteryModes.set(next,{teams:type===0,odds:type===0});applyLotteryDefaults(next);
 validateActiveRosterIds(next);return next;
}
async function regenerateLeagueRosters(){
 const assets=await loadGenerationAssets(),[data,blueprints,player,appearance,skillCatalog]=assets;
 const seed=crypto.getRandomValues(new Uint32Array(1))[0],gender=Number(league.meta?.gender)||0;
 const next=window.HLSTeamGenerator.regenerateLeague(league,data,blueprints,player,appearance,{seed,gender,skillCatalog});
 validateActiveRosterIds(next);return next;
}
function chooseNewLeagueSettings(){
 return new Promise(resolve=>{
  let dialog=document.querySelector('#templateLeagueTypeDialog');
  if(!dialog){
   dialog=el('dialog','template-type-dialog');dialog.id='templateLeagueTypeDialog';
   const head=el('div','dialog-head'),titleWrap=el('div');titleWrap.append(el('p','eyebrow','NEW LEAGUE'),el('h2','', 'Choose League Type'));
   const close=el('button','','✕');close.type='button';close.setAttribute('aria-label','Cancel league creation');head.append(titleWrap,close);
   const help=el('p','','Create a league with new teams, players, and staff.');help.id='newLeagueHelp';
   const actions=el('div','starter-actions template-type-actions'),pro=el('button','primary','Pro'),college=el('button','primary','College');
   pro.type=college.type='button';pro.dataset.leagueType='0';college.dataset.leagueType='1';actions.append(pro,college);dialog.append(head,help,actions);document.body.append(dialog);
  }
  dialog.querySelector('h2').textContent='Choose League Type';
  dialog.querySelector('#newLeagueHelp').textContent='Create a league with newly generated teams, players, and staff. The matching rules are applied automatically.';
  const initialActions=dialog.querySelector('.template-type-actions');initialActions.replaceChildren();
  for(const [type,label] of [[0,'Pro'],[1,'College']]){const button=el('button','primary',label);button.type='button';button.dataset.leagueType=String(type);initialActions.append(button)}
  let done=false;
  const finish=value=>{if(done)return;done=true;dialog.close();dialog.querySelectorAll('[data-league-type],[data-league-gender]').forEach(button=>button.onclick=null);dialog.querySelector('.dialog-head button').onclick=null;dialog.oncancel=null;resolve(value)};
  const chooseGender=type=>{
   dialog.querySelector('h2').textContent='Choose League Gender';
   dialog.querySelector('#newLeagueHelp').textContent='Choose whether the generated league uses male, female, or mixed player and staff rosters.';
   const actions=dialog.querySelector('.template-type-actions');actions.replaceChildren();
   for(const [gender,label] of [[0,'Male'],[1,'Female'],[2,'Mixed']]){const button=el('button','primary',label);button.type='button';button.dataset.leagueGender=String(gender);button.onclick=()=>finish({type,gender});actions.append(button)}
  };
  dialog.querySelectorAll('[data-league-type]').forEach(button=>button.onclick=()=>chooseGender(Number(button.dataset.leagueType)));
  dialog.querySelector('.dialog-head button').onclick=()=>finish(null);
  dialog.oncancel=event=>{event.preventDefault();finish(null)};
  dialog.showModal();
 });
}
function validateActiveRosterIds(data=league){
 const seen=new Map(),claim=(person,team,label,required)=>{
  const id=Number(person?.id),teamName=teamDisplayName(team)||'Team '+team.id;if((!Number.isInteger(id)||id<=0)&&required)throw Error(teamName+' has a '+label+' with an invalid person ID.');
  if(!Number.isInteger(id)||id<=0)return;
  if(seen.has(id))throw Error('Duplicate person ID '+id+' appears on '+seen.get(id)+' and '+teamName+' '+label+'.');
  seen.set(id,teamName+' '+label);
  if(Number(person?.tid)!==Number(team?.id))throw Error(label+' ID '+id+' has team ID '+person?.tid+' but belongs to team '+team.id+'.');
 };
 for(const team of data?.teams||[]){
  for(const player of Array.isArray(team?.roster)?team.roster:[])claim(player,team,'player',true);
  for(const person of Array.isArray(team?.frontOffice?.staff)?team.frontOffice.staff:[])claim(person,team,'staff member',false);
  for(const person of Array.isArray(team?.frontOffice?.announcers)?team.frontOffice.announcers:[])claim(person,team,'announcer',false);
 }
 return true;
}
function syncTeamCountMeta(data=league){
 if(!data||!Array.isArray(data.teams))return;
 data.meta||={};data.meta.teams=data.teams.length;
}
function normalizeTeamHoopGramTags(data){
 for(const collection of ['teams','starTeams']){
  for(const team of data?.[collection]||[]){
   const name=String(team?.name??'').trim(),city=String(team?.city??'').trim(),tag=String(team?.tag??'').trim();
   if(name&&(!tag||(city&&tag.toLowerCase()===city.toLowerCase())))team.tag=name;
  }
 }
 return data;
}
function protectedTeamIds(data=league){
 const ids=new Set();
 const add=v=>{if(Number.isInteger(Number(v)))ids.add(Number(v))};
 add(data.meta?.uTID);for(const team of data.teams||[])if(team?.isPlayer)add(team.id);
 return ids;
}
function removalCandidates(amount){
 const protectedIds=protectedTeamIds(),result=[];
 for(let i=league.teams.length-1;i>=0&&result.length<amount;i--){const team=league.teams[i];if(!protectedIds.has(Number(team.id)))result.push({team,index:i});}
 return result;
}
async function setLeagueTeamCount(requested){
 if(teamCountBusy)return false;
 const current=league.teams.length,target=Math.max(4,Math.min(64,Math.round(Number(requested))));
 if(!Number.isFinite(target)||target===current)return false;
 let next=league.teams.slice(),generated=0;
 if(target>current){
  teamCountBusy=true;syncTeamCountDisplays();$('#status').textContent='Generating expansion teams, players, and staff…';
  const originalTeams=league.teams,originalUPID=league.meta?.uPID;let generatedPersonnel=0;
  try{
   const [data,blueprints,player,appearance,skillCatalog]=await loadGenerationAssets();
   const expanded=window.HLSTeamGenerator.expandLeague(league,target,data,blueprints,player,appearance,{seed:crypto.getRandomValues(new Uint32Array(1))[0],skillCatalog});
   next=expanded.teams;league.meta.uPID=expanded.meta.uPID;
   for(const team of next.slice(current)){generated+=team.roster.length;generatedPersonnel+=team.frontOffice.staff.length+team.frontOffice.announcers.length;}
  }catch(error){league.teams=originalTeams;if(league.meta)league.meta.uPID=originalUPID;$('#status').textContent='Expansion needs attention';toast(error.message);alert(error.message);return false}
  finally{teamCountBusy=false}
 }else{
  const amount=current-target,candidates=removalCandidates(amount);
  if(candidates.length<amount){toast('Not enough removable teams. The controlled team is protected.');return false;}
  const names=candidates.map(({team})=>teamDisplayName(team)||'Team '+team.id),shown=names.slice(0,8).join(', ')+(names.length>8?' and '+(names.length-8)+' more':'');
  if(!confirm('Reduce the league from '+current+' to '+target+' teams? This permanently removes '+shown+' and their roster/staff data.'))return false;
  const remove=new Set(candidates.map(c=>c.index));next=next.filter((_,i)=>!remove.has(i));
 }
 league.teams=next;syncTeamCountMeta();locationSelections.clear();selected=Math.min(selected,Math.max(0,league.teams.length-1));teamList='teams';
 if(league.season){league.season.lotteryTeams=Math.min(Number(league.season.lotteryTeams)||0,league.teams.length);const conferenceCount=league.leagueType===1?Math.max(1,league.divisions?.length||1):Math.max(1,league.conferences?.length||2);let playoff=Math.min(Number(league.season.playoffTeams)||0,league.teams.length);if(playoff&&playoff%conferenceCount)playoff-=playoff%conferenceCount;league.season.playoffTeams=Math.max(conferenceCount,playoff||conferenceCount);}
 applyLotteryDefaults(league);syncSettingFields();for(const node of document.querySelectorAll('[data-lottery-odds]'))node.syncOdds();
 dirty=true;$('#status').textContent='Unsaved changes';syncTeamCountDisplays();toast(generated?'Total teams updated to '+league.teams.length+'. Generated '+generated+' expansion players'+(generatedPersonnel?' and '+generatedPersonnel+' staff/personnel.':'.'):'Total teams updated to '+league.teams.length+'.');return true;
}
function syncTeamCountDisplays(){
 syncTeamCountMeta();
 for(const input of document.querySelectorAll('[data-team-count]')){input.value=String(league.teams.length);input.disabled=teamCountBusy;const row=input.closest('.number-control');if(row){const buttons=row.querySelectorAll('button');if(buttons[0])buttons[0].disabled=teamCountBusy||league.teams.length<=4;if(buttons[1])buttons[1].disabled=teamCountBusy||league.teams.length>=64;}}
 for(const status of document.querySelectorAll('[data-team-count-status]'))status.textContent=league.teams.length+' teams · '+(league.awards||[]).filter(a=>a.enabled).length+' enabled awards';
 const subtitle=$('#subtitle');if(subtitle&&view==='league')subtitle.textContent=league.leagueType===1?`${league.teams.length} teams · ${league.divisions.length} conferences`:`${league.teams.length} teams · ${league.conferences.length} conferences · ${league.divisions.length} divisions`;
 listTeams();
 for(const old of [...document.querySelectorAll('.team-distribution-summary')]){const holder=el('div');renderTeamDistributionSummary(holder);old.replaceWith(holder.firstElementChild);}
 for(const n of document.querySelectorAll('[data-playoff-count]'))n.syncCount?.();
}
function renderTeamCountControl(parent){
 const wrap=el('div','field team-count-field'),row=el('div','number-control'),input=el('input'),minus=el('button','','−'),plus=el('button','','+');
 wrap.append(el('span','','Total Teams'));input.type='number';input.min='4';input.max='64';input.step='1';input.value=league.teams.length;input.dataset.teamCount='true';input.setAttribute('aria-label','Total Teams');minus.type=plus.type='button';minus.setAttribute('aria-label','Remove one team');plus.setAttribute('aria-label','Add one team');
 const sync=()=>{input.value=String(league.teams.length);input.disabled=teamCountBusy;minus.disabled=teamCountBusy||league.teams.length<=4;plus.disabled=teamCountBusy||league.teams.length>=64};
 minus.onclick=async()=>{if(!canNavigate())return;if(!(await setLeagueTeamCount(league.teams.length-1)))sync()};plus.onclick=async()=>{if(!canNavigate())return;if(!(await setLeagueTeamCount(league.teams.length+1)))sync()};input.onchange=async()=>{if(!canNavigate()){sync();return}if(!(await setLeagueTeamCount(input.value)))sync()};input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();input.blur()}};
 row.append(minus,input,plus);wrap.append(row);parent.append(wrap);sync();return wrap;
}
function renderTeamDistributionSummary(parent){
 const summary=el('div','team-distribution-summary');summary.append(el('h3','','Total Teams: '+league.teams.length));
 const divisions=league.divisions||[],teams=league.teams||[];
 if(league.leagueType===1){
  for(let d=0;d<divisions.length;d++){const count=teams.filter(t=>t.division===d).length;summary.append(el('div','team-distribution-conference',(divisions[d]||'Conference '+(d+1))+' — '+count+' '+(count===1?'team':'teams')));}
 }else{
  const conferences=league.conferences||[],conferenceCount=Math.max(1,conferences.length||2),perConference=Math.ceil(divisions.length/conferenceCount);
  for(let c=0;c<conferenceCount;c++){
   const start=c*perConference,end=Math.min(start+perConference,divisions.length),divisionIds=Array.from({length:Math.max(0,end-start)},(_,i)=>start+i),conferenceTeams=teams.filter(t=>divisionIds.includes(t.division)).length;
   summary.append(el('div','team-distribution-conference',(conferences[c]||'Conference '+(c+1))+' — '+conferenceTeams+' '+(conferenceTeams===1?'team':'teams')));
   for(const d of divisionIds){const count=teams.filter(t=>t.division===d).length;summary.append(el('div','team-distribution-division',(divisions[d]||'Division '+(d+1))+' — '+count));}
  }
 }
 const unassigned=teams.filter(t=>!Number.isInteger(t.division)||t.division<0||t.division>=divisions.length).length;if(unassigned)summary.append(el('div','team-distribution-unassigned','Unassigned — '+unassigned));parent.append(summary);return summary;
}
function applyCustomCourtDefaults(path,value){
 if((path.at(-2)!=='court'&&path[0]!=='tournamentCourts')||path.at(-1)!=='overlayURL'||!isCustomImage(value))return;
 const courtPath=path.slice(0,-1),court=get(courtPath);
 // Layer labels 1 and 2 are stored as 0 and 1 in Hoop Land.
 const defaults={logoSize:0,logoLayer:0,overlayLayer:1,baseline1:'',baseline2:''};
 Object.assign(court,defaults);
 for(const input of document.querySelectorAll('[data-path]')){
  for(const [key,value] of Object.entries(defaults)){
   if(input.dataset.path===JSON.stringify([...courtPath,key]))input.value=String(value);
  }
 }
}
function set(p,v){let o=league;for(const k of p.slice(0,-1))o=o[k];const previous=o[p.at(-1)];o[p.at(-1)]=v;updateLotterySetting(p,v);if(previous!==v)applyCustomCourtDefaults(p,v);if(p.length===1&&p[0]==='leagueName'&&view==='league')$('#title').textContent=String(v??'').trim()||'League settings';const scheduleChanged=p.length===2&&p[0]==='season'&&p[1]==='totalGames';if(scheduleChanged)applyScheduleDefaults(league,v);for(const n of document.querySelectorAll('[data-star-rating]'))n.syncRating();for(const n of document.querySelectorAll('[data-country-percentage]'))n.syncValue();for(const n of document.querySelectorAll('[data-playoff-count]'))n.syncCount();for(const n of document.querySelectorAll('[data-country-balance]'))n.syncBalance();for(const n of document.querySelectorAll('[data-contract-amount]'))n.syncAmount();const presetChanged=applySettingPreset(league,p,v);if(presetChanged||scheduleChanged)syncSettingFields();dirty=true;$('#status').textContent='Unsaved changes';for(const n of document.querySelectorAll('[data-award-preview]'))n.syncAwardPreview();for(const n of document.querySelectorAll('[data-color-path]'))n.syncColor();for(const n of document.querySelectorAll('[data-team-logo]'))n.syncTeamLogo?.();for(const n of document.querySelectorAll('[data-uniform-preview]'))n.syncUniformPreview?.();for(const n of document.querySelectorAll('[data-court-preview]'))n.syncCourtPreview?.();for(const n of document.querySelectorAll('[data-court-overlay-preview]'))n.syncOverlayHoops?.();if(['conferences','divisions'].includes(p[0])||(['teams','starTeams'].includes(p[0])&&(['division','city','name','shortName'].includes(p.at(-1))||p.includes('teamColors'))))listTeams();}
function retiredNumberInteger(value,fallback=0){const n=Number(value);return Number.isInteger(n)?n:fallback}
function retiredNumberRecord(entry){return {num:retiredNumberInteger(entry?.num),pid:retiredNumberInteger(entry?.pid),yr:retiredNumberInteger(entry?.yr)}}
function retiredNumberKey(entry){const record=retiredNumberRecord(entry);return record.num+'|'+record.pid+'|'+record.yr}
function retiredNumberTeams(data=league){return [...(data?.teams||[]),...(data?.starTeams||[])]}
function defineLeagueRetiredNumbers(data,entries){Object.defineProperty(data,LEAGUE_RETIRED_NUMBERS_KEY,{value:entries,writable:true,configurable:true,enumerable:false});return entries}
function inferLeagueRetiredNumbers(data){
 const teams=retiredNumberTeams(data);if(!teams.length)return [];
 const first=Array.isArray(teams[0].retiredNumbers)?teams[0].retiredNumbers:[],seen=new Set(),result=[];
 for(const entry of first){const record=retiredNumberRecord(entry),key=retiredNumberKey(record);if(seen.has(key))continue;if(teams.every(team=>(team.retiredNumbers||[]).some(candidate=>retiredNumberKey(candidate)===key))){seen.add(key);result.push(record)}}
 return result;
}
function leagueRetiredNumbers(data=league){const current=data?.[LEAGUE_RETIRED_NUMBERS_KEY];return Array.isArray(current)?current:defineLeagueRetiredNumbers(data,inferLeagueRetiredNumbers(data))}
function retiredNumberPlayerNumber(player){
 const value=player?.num??player?.number??player?.jersey??player?.jerseyNumber;
 const number=Number(value);return Number.isInteger(number)&&number>=0&&number<=100?number:null;
}
function retiredNumberPlayerAge(player){
 const age=Number(player?.age);return Number.isFinite(age)&&age>0&&age<150?age:null;
}
function retiredNumberPlayerRetirementYear(player){
 const year=Number(player?.yearRetired);return Number.isInteger(year)&&year>0?year:null;
}
function retiredNumberPlayerStatus(player,source='Active'){
 const yearRetired=retiredNumberPlayerRetirementYear(player);return source==='Hall of Fame'?'Hall of Fame':source==='Retired'||player?.retired===true||yearRetired!==null?'Retired':'Active';
}
function retiredNumberPlayerStatusRank(status){
 return {Active:1,Retired:2,'Hall of Fame':3}[status]||0;
}
function retiredNumberPlayers(data=league){
 const byId=new Map(),teams=retiredNumberTeams(data);
 const add=(player,team=null,source='Active')=>{
  const id=Number(player?.id);if(!Number.isInteger(id))return;
  const name=[player.fn,player.ln].filter(Boolean).join(' ')||player.name||'Player '+id;
  const teamName=team?teamDisplayName(team):'';
  const current={id,name,firstName:player.fn||'',lastName:player.ln||'',age:retiredNumberPlayerAge(player),status:retiredNumberPlayerStatus(player,source),num:retiredNumberPlayerNumber(player),yearRetired:retiredNumberPlayerRetirementYear(player),teamName,teamId:team?.id};
  const existing=byId.get(id);
  if(!existing){byId.set(id,current);return}
  if(existing.num===null&&current.num!==null)existing.num=current.num;
  if(existing.age===null&&current.age!==null)existing.age=current.age;
  if(existing.yearRetired===null&&current.yearRetired!==null)existing.yearRetired=current.yearRetired;
  if(retiredNumberPlayerStatusRank(current.status)>retiredNumberPlayerStatusRank(existing.status))existing.status=current.status;
  if(!existing.teamName&&current.teamName){existing.teamName=current.teamName;existing.teamId=current.teamId}
 };
 for(const team of teams)for(const player of Array.isArray(team?.roster)?team.roster:[])add(player,team);
 for(const group of ['draftClass','freeAgents','threePointContestants','retirees','hallOfFame'])for(const player of Array.isArray(data?.[group])?data[group]:[])add(player,null,group==='hallOfFame'?'Hall of Fame':group==='retirees'?'Retired':'Active');
 return [...byId.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.id-b.id);
}
function retiredNumberPlayerMatches(players,query){
 const q=String(query||'').trim().toLocaleLowerCase();if(!q)return [];
 const matches=[];
 for(const player of players){
  if(player.status==='Active')continue;
  const values=[player.name,player.firstName,player.lastName].map(value=>String(value||'').toLocaleLowerCase());
  const starts=values.some(value=>value.startsWith(q)),contains=values.some(value=>value.includes(q));
  if(starts||contains)matches.push({player,starts,contains});
 }
 return matches.sort((a,b)=>Number(b.starts)-Number(a.starts)||Number(b.contains)-Number(a.contains)||a.player.name.localeCompare(b.player.name)||a.player.id-b.player.id).map(item=>item.player);
}
function defaultRetiredNumberYear(){return retiredNumberInteger(league?.season?.startingYear,new Date().getFullYear())}
function nextRetiredNumber(entries){const used=new Set((entries||[]).map(entry=>retiredNumberInteger(entry?.num)));for(let number=0;number<=100;number++)if(!used.has(number))return number;return 0}
function syncLeagueRetiredNumberTeams(previous,next,data=league){
 const previousKeys=new Set(previous.map(retiredNumberKey)),nextKeys=new Set(next.map(retiredNumberKey));
 for(const team of retiredNumberTeams(data)){
  const current=Array.isArray(team.retiredNumbers)?team.retiredNumbers:[];
  const kept=current.filter(entry=>!previousKeys.has(retiredNumberKey(entry))||nextKeys.has(retiredNumberKey(entry)));
  for(const entry of next){const record=retiredNumberRecord(entry);if(!kept.some(candidate=>retiredNumberInteger(candidate?.num)===record.num))kept.push({...record})}
  team.retiredNumbers=kept;
 }
}
function setLeagueRetiredNumbers(entries){
 const previous=leagueRetiredNumbers().map(retiredNumberRecord),seenNumbers=new Set(),next=[];
 for(const entry of entries||[]){const record=retiredNumberRecord(entry);if(seenNumbers.has(record.num))continue;seenNumbers.add(record.num);next.push(record)}
 set([LEAGUE_RETIRED_NUMBERS_KEY],next);syncLeagueRetiredNumberTeams(previous,next);return next;
}
function resolvedColor(value,path){const index=['PRI','SEC','TER'].indexOf(value);if(index>=0&&path[0]==='tournamentCourts')value=league.teams?.[0]?.teamColors?.[index];if(index>=0&&['teams','starTeams'].includes(path[0]))value=league[path[0]][path[1]].teamColors?.[index];return /^[a-f0-9]{6}$/i.test(value)?'#'+value:'#ffffff';}
const UNIFORM_LAYER_ROOT='https://raw.githubusercontent.com/Galileo88/HoopLeagueStudio/main/jersey';
const UNIFORM_PREVIEW_LAYERS=[
 [null,'outline.png','Outline'],
 ['jersey','jersey_color.png','Jersey'],
 ['jerseyStripe','jersey_stripes.png','Jersey stripes'],
 ['shorts','shorts_color.png','Shorts'],
 ['shortsStripe','shorts_stripes.png','Shorts stripes'],
 ['jerseyCollar','collar.png','Collar'],
 ['jerseyNumber','numbers.png','Jersey number']
];
function isUniformPath(path){return path?.length===4&&['teams','starTeams'].includes(path[0])&&path[2]==='uniforms'}
function applyUniformLayerMask(node,file){
 // Every layer covers the same uniform canvas. The 39×39 number mask is a
 // higher-resolution version of the 13×13 canvas, not a larger garment layer.
 const local='./assets/images/jerseys/'+file,remote=UNIFORM_LAYER_ROOT+'/'+file,apply=url=>{const css='url("'+url+'")';node.style.webkitMaskImage=css;node.style.maskImage=css;node.style.backgroundImage=css};
 const probe=new Image();probe.onload=()=>apply(local);probe.onerror=()=>apply(remote);probe.src=local;
}
function renderUniformPreview(parent,path){
 if(!isUniformPath(path))return;
 const preview=el('div','uniform-preview');preview.dataset.uniformPreview='true';
 const stage=el('div','uniform-preview-stage');stage.setAttribute('role','img');stage.setAttribute('aria-label','Uniform color preview');
 const layers=[];
 for(const [key,file]of UNIFORM_PREVIEW_LAYERS){
  const layer=el('span','uniform-preview-layer');applyUniformLayerMask(layer,file);stage.append(layer);layers.push({key,layer});
 }
 preview.append(stage);parent.append(preview);
 preview.syncUniformPreview=()=>{const uniform=get(path)||{};for(const item of layers){const color=item.key?resolvedColor(uniform[item.key],path):'#000000';item.layer.style.backgroundColor=color}};
 preview.syncUniformPreview();
}
const UNIFORM_FIELD_ORDER=[
 ['jersey','Jersey Color'],
 ['jerseyStripe','Jersey Stripe'],
 ['jerseyCollar','Jersey Collar'],
 ['shorts','Shorts Color'],
 ['shortsStripe','Shorts Stripe'],
 ['jerseyNumber','Jersey Number']
];
function renderUniformsEditor(parent,uniforms,path){
 const editor=el('div','uniform-editor'),cards=el('div','uniform-card-grid'),controls=el('div','uniform-color-grid');
 let active=0;
 editor.append(cards,controls);parent.append(editor);
 const names=['Home','Road','Alt 1','Alt 2'];
 const buttons=[];
 const drawControls=()=>{
  controls.replaceChildren();
  const uniform=uniforms[active]||{};
  for(const [key,title]of UNIFORM_FIELD_ORDER){
   if(!Object.hasOwn(uniform,key))continue;
   field(controls,key,uniform[key],[...path,active,key]);
   const last=controls.lastElementChild;
   const labelNode=last?.querySelector(':scope > span');
   if(labelNode)labelNode.textContent=title;
  }
  for(const [i,button]of buttons.entries()){
   const selected=i===active;
   button.classList.toggle('selected',selected);
   button.setAttribute('aria-pressed',String(selected));
  }
 };
 for(const [i,uniform]of uniforms.entries()){
  const button=el('button','uniform-card');button.type='button';button.setAttribute('aria-pressed','false');button.setAttribute('aria-label',(names[i]||'Uniform '+(i+1))+' uniform');
  button.append(el('span','uniform-card-title',names[i]||'Uniform '+(i+1)));
  renderUniformPreview(button,[...path,i]);
  button.onclick=()=>{active=i;drawControls()};
  cards.append(button);buttons.push(button);
 }
 if(!uniforms.length){editor.append(el('p','','No uniforms in this team.'));cards.remove();controls.remove();return}
 drawControls();
}

function toast(t){$('#toast').textContent=t;$('#toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').style.display='none',3500)}
function safeURL(s){if(typeof s==='string'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\r\n]+$/i.test(s))return true;try{const u=new URL(s);return ['http:','https:'].includes(u.protocol)}catch{return false}}

function locationNormalize(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase()}
function hoopLandCountry(codeOrName){
 const needle=locationNormalize(codeOrName);
 return HOOPLAND_HOMETOWNS.find(country=>locationNormalize(country[1])===needle||locationNormalize(country[0])===needle)||null;
}
function hoopLandCountryHasRegions(country){return !!country?.[2]?.some(region=>String(region?.[0]||'').trim())}
function hoopLandRegions(country){return (country?.[2]||[]).filter(region=>String(region?.[0]||'').trim()).slice().sort((a,b)=>String(a[0]).localeCompare(String(b[0])))}
function hoopLandCities(country,regionName=''){
 if(!country)return [];
 const hasRegions=hoopLandCountryHasRegions(country);
 if(hasRegions){
  const target=locationNormalize(regionName);
  const region=(country[2]||[]).find(item=>locationNormalize(item?.[0])===target);
  return (region?.[2]||[]).slice().sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
 }
 const result=[];for(const region of country[2]||[])for(const city of region?.[2]||[])result.push(city);
 return result.sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
}
function supportedLocationByCoordinates(x,y){
 x=Number(x);y=Number(y);if(!Number.isFinite(x)||!Number.isFinite(y))return null;
 x=Math.round(x);y=Math.round(y);
 for(const country of HOOPLAND_HOMETOWNS)for(const region of country[2]||[])for(const city of region?.[2]||[])if(Number(city?.[1])===x&&Number(city?.[2])===y)return {country:country[0],countryCode:country[1],region:region[0]||'',regionCode:region[1]||'',city:city[0],x:Number(city[1]),y:Number(city[2])};
 return null;
}
// Legacy Lexington coordinates are not a recognized Hoop Land hometown.
function normalizeLexingtonLocations(data){
 for(const team of [...(data.teams||[]),...(data.starTeams||[])]){
  if(locationNormalize(team.city)==='lexington'&&Number(team.location?.x)===3798&&Number(team.location?.y)===-8447){
   team.location={...team.location,x:3803,y:-8450};
  }
 }
}
function supportedLocationForTeam(team){
 const x=Number(team?.location?.x),y=Number(team?.location?.y),byCoords=supportedLocationByCoordinates(x,y);if(byCoords)return byCoords;
 const cityName=locationNormalize(team?.city);if(!cityName)return null;
 const candidates=[];
 for(const country of HOOPLAND_HOMETOWNS)for(const region of country[2]||[])for(const city of region?.[2]||[])if(locationNormalize(city?.[0])===cityName)candidates.push({country:country[0],countryCode:country[1],region:region[0]||'',regionCode:region[1]||'',city:city[0],x:Number(city[1]),y:Number(city[2])});
 if(!candidates.length)return null;
 if(Number.isFinite(x)&&Number.isFinite(y))candidates.sort((a,b)=>(Math.abs(a.x-x)+Math.abs(a.y-y))-(Math.abs(b.x-x)+Math.abs(b.y-y)));
 return candidates[0];
}
function locationState(path,team){
 const key=path.join(':');let state=locationSelections.get(key);
 if(!state){const match=supportedLocationForTeam(team);state={countryCode:match?.countryCode||'',region:match?.region||'',x:match?.x??null,y:match?.y??null};locationSelections.set(key,state)}
 return state;
}
function renderTeamLocation(parent,team,path){
 const state=locationState(path,team),section=el('details','location-picker');section.append(el('summary','','Location'));
 const fields=el('div','fields'),countryWrap=el('label','field'),regionWrap=el('label','field'),cityWrap=el('label','field'),country=el('select'),region=el('select'),city=el('select');
 countryWrap.append(el('span','','Country'),country);regionWrap.append(el('span','','State / Province / Region'),region);cityWrap.append(el('span','','City'),city);fields.append(countryWrap,regionWrap,cityWrap);section.append(fields);
 const prefixWrap=el('label','field wide'),prefix=el('input');
 prefix.type='text';prefix.value=team.city??'';prefix.placeholder=geographicTeamCity(team);prefix.dataset.path=JSON.stringify([...path,'city']);
 prefixWrap.append(el('span','','City Name'),prefix,el('small','','Leave blank to use the selected city.'));fields.append(prefixWrap);
 prefix.oninput=()=>{set([...path,'city'],prefix.value);if(view==='team')$('#title').textContent=teamDisplayName(team);for(const name of document.querySelectorAll('.team-config-name'))name.textContent=teamDisplayName(team)};
 const status=el('p','location-status'),coords=el('p','location-coords');section.append(status,coords);
 const countryPlaceholder=el('option','','Choose a country');countryPlaceholder.value='';country.append(countryPlaceholder);
 for(const item of HOOPLAND_HOMETOWNS.slice().sort((a,b)=>String(a[0]).localeCompare(String(b[0])))){const option=el('option','',item[0]);option.value=item[1];country.append(option)}
 country.value=state.countryCode&&hoopLandCountry(state.countryCode)?state.countryCode:'';
 const ensureLocation=()=>{if(!team.location||typeof team.location!=='object'||Array.isArray(team.location)){team.location={x:0,y:0};dirty=true}};
 const syncCoords=()=>{
  const x=Number(team?.location?.x),y=Number(team?.location?.y),match=supportedLocationByCoordinates(x,y);
  coords.textContent=Number.isFinite(x)&&Number.isFinite(y)?`Coordinates: X ${Math.round(x)} · Y ${Math.round(y)}`:'No location selected';
  if(match){status.textContent='Hoop Land supported location';status.hidden=false;status.className='location-status ok'}
  else if(Number.isFinite(x)&&Number.isFinite(y)){status.textContent='Current location is not in the supported hometown list. Choose a location above to replace it.';status.hidden=false;status.className='location-status'}
  else{status.textContent='Choose a supported Hoop Land hometown.';status.hidden=false;status.className='location-status'}
 };
 const rebuildCities=()=>{
  city.replaceChildren();const placeholder=el('option','','Choose a city');placeholder.value='';city.append(placeholder);
  const selectedCountry=hoopLandCountry(country.value),needsRegion=hoopLandCountryHasRegions(selectedCountry);
  if(!selectedCountry||(needsRegion&&!region.value)){city.disabled=true;city.value='';return}
  const cities=hoopLandCities(selectedCountry,region.value),counts=new Map();for(const entry of cities)counts.set(entry[0],(counts.get(entry[0])||0)+1);
  let selectedValue='';
  cities.forEach((entry,index)=>{
   const value=`${index}:${entry[1]}:${entry[2]}`,duplicate=(counts.get(entry[0])||0)>1;
   const option=el('option','',duplicate?`${entry[0]} · X ${entry[1]}, Y ${entry[2]}`:entry[0]);option.value=value;option.dataset.city=entry[0];option.dataset.x=String(entry[1]);option.dataset.y=String(entry[2]);city.append(option);
   if(Number(entry[1])===Number(state.x)&&Number(entry[2])===Number(state.y))selectedValue=value;
  });
  city.disabled=false;city.value=selectedValue;
 };
 const rebuildRegions=()=>{
  region.replaceChildren();const selectedCountry=hoopLandCountry(country.value);
  if(!selectedCountry){const option=el('option','','Choose a country first');option.value='';region.append(option);region.disabled=true;state.region='';rebuildCities();return}
  if(!hoopLandCountryHasRegions(selectedCountry)){const option=el('option','','Not used for this country');option.value='';region.append(option);region.disabled=true;state.region='';rebuildCities();return}
  const placeholder=el('option','','Choose a state / region');placeholder.value='';region.append(placeholder);
  for(const item of hoopLandRegions(selectedCountry)){const option=el('option','',item[0]);option.value=item[0];region.append(option)}
  region.disabled=false;region.value=hoopLandRegions(selectedCountry).some(item=>item[0]===state.region)?state.region:'';
  if(!region.value)state.region='';
  rebuildCities();
 };
 country.onchange=()=>{state.countryCode=country.value;state.region='';state.x=state.y=null;rebuildRegions()};
 region.onchange=()=>{state.region=region.value;state.x=state.y=null;rebuildCities()};
 city.onchange=()=>{
  const option=city.options[city.selectedIndex];if(!option?.value)return;
  const cityName=option.dataset.city,x=Number(option.dataset.x),y=Number(option.dataset.y);if(!cityName||!Number.isFinite(x)||!Number.isFinite(y))return;
  ensureLocation();state.x=x;state.y=y;
  // The game stores the display prefix separately from geographic coordinates.
  if(Number(team.location.x)!==x)set([...path,'location','x'],x);
  if(Number(team.location.y)!==y)set([...path,'location','y'],y);
  prefix.placeholder=geographicTeamCity(team);listTeams();if(view==='team')$('#title').textContent=teamDisplayName(team);for(const name of document.querySelectorAll('.team-config-name'))name.textContent=teamDisplayName(team);syncCoords();
 };
 rebuildRegions();syncCoords();parent.append(section);
}
function isColor(k,v,p){return typeof v==='string'&&(/^[0-9a-f]{6}$/i.test(v)||['PRI','SEC','TER'].includes(v)||p.includes('teamColors')||/C$/.test(k)&&k!=='CPU');}
function difficultyOptions(path){
 if(path.length===2&&path[0]==='meta'&&path[1]==='gender')return ['Male','Female','Mixed'];
 if(path.length===2&&path[0]==='season')return {optimization:['Low','High','Custom'],simulationPreset:['Default','Custom']}[path[1]]||null;
 if(path.length===2&&path[0]==='rules')return {shootingFouls:['Off','Low','Med','High'],offFouls:['Off','Low','Med','High'],bonus:['5','6','7'],foulOut:['Off','5','6','10'],oneAndOne:['Off','On'],backcourt:['Off','On'],defGoaltending:['Off','On'],offGoaltending:['Off','On'],offThreeSeconds:['Off','On']}[path[1]]||null;
 if(path.length===2&&path[0]==='settings')return {gameLength:['4','6','8','10','12','16','20','24','32','40','48'],totalPeriods:['2 Halves','4 Quarters'],shotClock:['14','24','30'],difficulty:['Rookie','Pro','All-Star','Custom'],rules:['Pro','College','Custom'],gameStyle:['Simulation','Arcade','Custom']}[path[1]]||null;
 if(path.length!==2||path[0]!=='difficulty')return null;
 return {shotSpeed:['×0.5','×0.66','×1.0'],shotStyle:['Timing','Player %'],CPUShotTiming:['Poor','Average','Great'],CPUReactionTime:['Poor','Average','Great'],CPUPlayerSpeed:['Slower','Normal','Faster']}[path[1]]||null;
}
function renderNumericControl(parent,key,value,path){
 const range=path.length===2&&['sliders','simulationSliders'].includes(path[0]);
 const bounded=path.length===2&&path[0]==='season'&&['injuryProbability','simulationPace','progressionRate'].includes(key);
 const hof=path.length===2&&path[0]==='season'&&key==='HOFbar';
 const country=path.length===4&&path[0]==='meta'&&path[1]==='generatedCountries'&&key==='value';
 const extra=country||(path[0]==='season'||path[0]==='awards')&&!difficultyOptions(path);
 if(typeof value!=='number'||!range&&!bounded&&!hof&&!extra)return false;
 const weight=path[0]==='awards'&&(/^[A-Z]+$/.test(key)||key==='HOFValue'||key==='TimeWon'),odds=path[1]==='lotteryOdds';
 const scale=odds?10:1;
 const totalGames=path.length===2&&path[0]==='season'&&key==='totalGames';
 const min=totalGames?29:bounded?-5:weight?-Infinity:0,max=totalGames?100:range||odds||country?100:bounded?5:Infinity,step=range?5:weight||odds?0.1:1;
 const wrap=el('div','field'),row=el('div','number-control'),input=el('input'),out=el('output');
 wrap.append(el('span','',country?'Percentage (%)':odds?'Seed '+(Number(key)+1)+' (%)':path[1]==='seriesLength'?'Round '+(Number(key)+1):path[0]==='simulationSliders'&&key==='dunkAccuracy'?'Dunk Accuracy':label(key)));input.type=range?'range':'number';input.min=String(min);if(Number.isFinite(max))input.max=String(max);input.step=String(step);input.value=String(value);input.dataset.path=JSON.stringify(path);input.setAttribute('aria-label',label(key));
 const minus=el('button','','−'),plus=el('button','','+');minus.type=plus.type='button';
 minus.setAttribute('aria-label','Decrease '+label(key));plus.setAttribute('aria-label','Increase '+label(key));
 const limit=()=>country?Math.max(0,100-get(['meta','generatedCountries']).reduce((total,c,i)=>total+(i===Number(path[2])?0:Number(c.value)||0),0)):max;
 if(country)input.dataset.countryPercentage='true';
 input.syncValue=()=>{if(country)input.max=String(limit());const v=get(path)/scale,display=weight?v.toFixed(2):String(v);input.value=display;out.value=display;out.textContent=display;minus.disabled=v<=min;plus.disabled=v>=limit()};
 const update=v=>{if(!Number.isFinite(v))return;set(path,Number((Math.max(min,Math.min(limit(),Number((Math.round(v/step)*step).toFixed(6))))*scale).toFixed(6)));input.syncValue()};
 minus.onclick=()=>update(get(path)/scale-step);plus.onclick=()=>update(get(path)/scale+step);input.oninput=()=>update(Number(input.value));input.onchange=()=>input.syncValue();
 row.append(minus,input,plus);if(range)row.append(out);wrap.append(row);parent.append(wrap);input.syncValue();return true;
}
function renderOptimization(parent){
 const box=el('div','optimization-options');box.append(el('h4','','Optimization Options'));const fields=el('div','fields');box.append(fields);parent.append(box);
 for(const [key,title]of [['teamLogos','Custom Team Logos'],['courts','Custom Team Courts'],['tableGraphics','Custom Table Graphics'],['disableBoxScores','Box Scores']]){
  const wrap=el('label','field'),select=el('select');wrap.append(el('span','',title));
  for(const [value,text]of [['1','Off'],['0','On']]){const option=el('option','',text);option.value=value;select.append(option)}
  select.dataset.path=JSON.stringify(['optimization',key]);select.setAttribute('aria-label',title);
  select.syncValue=()=>{select.value=league.optimization?.[key]?'1':'0'};select.syncValue();
  select.onchange=()=>{league.optimization||={};set(['optimization',key],select.value==='1')};wrap.append(select);fields.append(wrap);
 }
}
function renderContract(parent,key,value,path){
 if(path.length!==3||path[0]!=='season'||path[1]!=='maxContract')return false;
 const title=['0–6 Years of Experience','7–9 Years of Experience','10+ Years of Experience'][Number(key)]||'Experience Group '+(Number(key)+1);
 const wrap=el('label','field'),input=el('input'),amount=el('small');wrap.append(el('span','',title+' (%)'));input.type='number';input.min='0';input.max='100';input.step='1';input.value=value;input.dataset.path=JSON.stringify(path);input.setAttribute('aria-label',title+' (%)');
 amount.dataset.contractAmount=String(key);amount.syncAmount=()=>{const pct=get(path),cap=league.season.salaryCap;amount.textContent=pct+'% ('+Number((cap*pct/100).toFixed(2))+'M)'};amount.syncAmount();
 input.oninput=()=>{const n=Number(input.value);if(input.value!==''&&Number.isFinite(n)&&n>=0&&n<=100){set(path,n);wrap.classList.remove('invalid')}else wrap.classList.add('invalid')};const row=el('div','number-control'),minus=el('button','','−'),plus=el('button','','+');minus.type=plus.type='button';minus.setAttribute('aria-label','Decrease '+title);plus.setAttribute('aria-label','Increase '+title);const change=d=>{input.value=String(Math.max(0,Math.min(100,Number(get(path))+d)));input.oninput();amount.syncAmount()};minus.onclick=()=>change(-1);plus.onclick=()=>change(1);row.append(minus,input,plus);wrap.append(row,amount);parent.append(wrap);return true;
}
const hoopLandCountries=[["AL","Albania"],["DZ","Algeria"],["AR","Argentina"],["AU","Australia"],["AT","Austria"],["BS","Bahamas"],["BD","Bangladesh"],["BB","Barbados"],["BY","Belarus"],["BE","Belgium"],["BA","Bosnia & Herzegovina"],["BR","Brazil"],["BN","Brunei"],["BG","Bulgaria"],["KH","Cambodia"],["CM","Cameroon"],["CA","Canada"],["KY","Cayman Islands"],["CL","Chile"],["CN","China"],["CO","Colombia"],["CG","Congo - Brazzaville"],["CR","Costa Rica"],["HR","Croatia"],["CU","Cuba"],["CY","Cyprus"],["CZ","Czechia"],["DK","Denmark"],["DO","Dominican Republic"],["EC","Ecuador"],["EG","Egypt"],["SV","El Salvador"],["EE","Estonia"],["FI","Finland"],["FR","France"],["GE","Georgia"],["DE","Germany"],["GH","Ghana"],["GR","Greece"],["GT","Guatemala"],["HT","Haiti"],["HN","Honduras"],["HK","Hong Kong SAR China"],["HU","Hungary"],["IS","Iceland"],["IN","India"],["ID","Indonesia"],["IR","Iran"],["IQ","Iraq"],["IE","Ireland"],["IL","Israel"],["IT","Italy"],["JM","Jamaica"],["JP","Japan"],["KZ","Kazakhstan"],["KW","Kuwait"],["LA","Laos"],["LV","Latvia"],["LB","Lebanon"],["LY","Libya"],["LT","Lithuania"],["LU","Luxembourg"],["MY","Malaysia"],["MT","Malta"],["MX","Mexico"],["MA","Morocco"],["NL","Netherlands"],["NZ","New Zealand"],["NI","Nicaragua"],["NG","Nigeria"],["MK","North Macedonia"],["NO","Norway"],["PK","Pakistan"],["PS","Palestinian Territories"],["PA","Panama"],["PY","Paraguay"],["PE","Peru"],["PH","Philippines"],["PL","Poland"],["PT","Portugal"],["PR","Puerto Rico"],["RO","Romania"],["RU","Russia"],["WS","Samoa"],["SA","Saudi Arabia"],["SN","Senegal"],["RS","Serbia"],["SG","Singapore"],["SK","Slovakia"],["SI","Slovenia"],["SO","Somalia"],["ZA","South Africa"],["KR","South Korea"],["ES","Spain"],["LK","Sri Lanka"],["SE","Sweden"],["CH","Switzerland"],["SY","Syria"],["TW","Taiwan"],["TH","Thailand"],["TT","Trinidad & Tobago"],["TN","Tunisia"],["TR","Türkiye"],["UG","Uganda"],["UA","Ukraine"],["UK","United Kingdom"],["US","United States"],["UY","Uruguay"],["UZ","Uzbekistan"],["VE","Venezuela"],["VN","Vietnam"]];
const PLAYER_POSITION_LABELS=['PG','G','SG','GF','SF','F','PF','FC','C'];
function isPlayerPositionPath(path){return path?.[0]==='freeAgents'||(['teams','starTeams'].includes(path?.[0])&&path?.[2]==='roster')}
function field(parent,key,value,path){if(renderContract(parent,key,value,path))return;if(renderNumericControl(parent,key,value,path))return;const wrap=el('label','field'),name=el('span','',key==='adsURL'?'Ad Image URL':key==='adSize'?'Ad Image Size':key==='tag'&&path.length===3&&['teams','starTeams'].includes(path[0])?'Hoop Gram Username':label(key));wrap.append(name);let input,builtinLogoBox=null,preservedBuiltinLogo=key==='logoURL'&&path.length===3&&['teams','starTeams'].includes(path[0])&&typeof value==='string'&&value.trim()&&!isCustomImage(value)?value.trim():'';
 if(key==='country'&&path.length===4&&path[0]==='meta'&&path[1]==='generatedCountries'){input=el('select');for(const [code,title]of hoopLandCountries){const option=el('option','',title+' ('+code+')');option.value=code;input.append(option)}if(!hoopLandCountries.some(([code])=>code===value)){const option=el('option','','Imported country ('+(value||'blank')+')');option.value=value??'';option.disabled=true;input.append(option)}input.value=value;input.onchange=()=>set(path,input.value);wrap.append(input)}
 else if(difficultyOptions(path)){const options=difficultyOptions(path);input=el('select');options.forEach((title,i)=>{const option=el('option','',title);option.value=String(i);input.append(option)});const selectedValue=typeof value==='boolean'?Number(value):value;if(!Number.isInteger(selectedValue)||selectedValue<0||selectedValue>=options.length){const option=el('option','','Unknown option ('+value+')');option.value=String(selectedValue);option.disabled=true;input.append(option)}input.value=String(selectedValue);input.onchange=()=>set(path,typeof value==='boolean'?input.value==='1':Number(input.value));wrap.append(input)}
 else if(typeof value==='boolean'){input=el('input');input.type='checkbox';input.checked=value;input.onchange=()=>set(path,input.checked);wrap.append(input)}
 else if(key==='leagueType'&&path.length===1){wrap.classList.add('wide');input=el('select');for(const [v,title]of [[0,'Pro'],[1,'College']]){const option=el('option','',title);option.value=String(v);input.append(option)}if(![0,1].includes(value)){const option=el('option','','Unknown type ('+value+')');option.value=String(value);option.disabled=true;input.append(option)}input.value=String(value);input.onchange=()=>{set(path,Number(input.value));render()};wrap.append(input)}
 else if(key==='pos'&&isPlayerPositionPath(path)){input=el('select');PLAYER_POSITION_LABELS.forEach((title,v)=>{const option=el('option','',title);option.value=String(v);input.append(option)});if(!Number.isInteger(Number(value))||Number(value)<0||Number(value)>=PLAYER_POSITION_LABELS.length){const option=el('option','','Unknown position ('+value+')');option.value=String(value);option.disabled=true;input.append(option)}input.value=String(value);input.onchange=()=>set(path,Number(input.value));wrap.append(input)}
 else if(key==='division'&&path.length===3&&['teams','starTeams'].includes(path[0])){name.textContent=league.leagueType===1?'Conference':'Division';input=el('select','team-division-select');league.divisions.forEach((name,i)=>{const o=el('option','',name);o.value=i;input.append(o)});input.value=value;input.onchange=()=>set(path,Number(input.value));wrap.append(input)}
 else if(key==='logoSize'&&(path.includes('court')||path[0]==='tournamentCourts')){input=el('select','court-option-select');for(const [v,title]of [[0,'0%'],[1,'50%'],[2,'100%'],[3,'150%'],[4,'200%']]){const option=el('option','',title);option.value=String(v);input.append(option)}if(![0,1,2,3,4].includes(value)){const option=el('option','','Unknown size ('+value+')');option.value=String(value);option.disabled=true;input.append(option)}input.value=String(value);input.onchange=()=>set(path,Number(input.value));wrap.append(input)}
 else if(key==='threePointLine'&&(path.includes('court')||path[0]==='tournamentCourts')){input=el('select','court-option-select');for(const [v,title]of [[0,'Pro'],[1,'College'],[2,'None']]){const option=el('option','',title);option.value=String(v);input.append(option)}if(![0,1,2].includes(value)){const option=el('option','','Unknown ('+value+')');option.value=String(value);option.disabled=true;input.append(option)}input.value=String(value);input.onchange=()=>set(path,Number(input.value));wrap.append(input)}
 else if((key==='logoLayer'||key==='overlayLayer')&&(path.includes('court')||path[0]==='tournamentCourts')){input=el('select','court-option-select');for(const [v,title]of [[0,'1'],[1,'2']]){const option=el('option','',title);option.value=String(v);input.append(option)}if(![0,1].includes(value)){const option=el('option','','Unknown ('+value+')');option.value=String(value);option.disabled=true;input.append(option)}input.value=String(value);input.onchange=()=>set(path,Number(input.value));wrap.append(input)}
 else if(['outerWood','innerWood','outerFT','innerFT','outerKey','innerKey'].includes(key)&&(path.includes('court')||path[0]==='tournamentCourts')){input=el('select','court-option-select');for(const v of ['flat','lines','tiled','parquet','combs']){const option=el('option','',v.charAt(0).toUpperCase()+v.slice(1));option.value=v;input.append(option)}if(!['flat','lines','tiled','parquet','combs'].includes(String(value))){const option=el('option','','Imported style ('+(value||'blank')+')');option.value=String(value??'');option.disabled=true;input.append(option)}input.value=String(value??'');input.onchange=()=>set(path,input.value);wrap.append(input)}
 else if(typeof value==='number'){input=el('input');input.type='number';input.step=Number.isInteger(value)?'1':'any';input.value=value;input.required=true;input.oninput=()=>{if(input.value!==''&&Number.isFinite(input.valueAsNumber)&&input.checkValidity()){set(path,input.valueAsNumber);wrap.classList.remove('invalid')}else wrap.classList.add('invalid')};wrap.append(input);if(/Type|Layer|Style|difficulty|gameLength|totalPeriods|shotClock|referee|gameBall|threePointLine|logoSize/i.test(key))wrap.append(el('small','','Stored game value; labels are not yet verified.'))}
 else {input=el('input');input.value=preservedBuiltinLogo?'':value??'';input.oninput=()=>set(path,input.value);if(isColor(key,value,path)){const row=el('div','color-line'),swatch=el('input');swatch.type='color';swatch.value=resolvedColor(value,path);swatch.setAttribute('aria-label',label(key)+' color');swatch.oninput=()=>{input.value=swatch.value.slice(1).toUpperCase();set(path,input.value)};const suppressLogoPicker=(path.includes('court')||path[0]==='tournamentCourts')||path.includes('uniforms');const pick=suppressLogoPicker?null:el('button','','Pick from team logo');if(pick){pick.type='button';pick.onclick=()=>openPicker(path)}const refs=el('select');refs.setAttribute('aria-label','Team color reference');for(const [v,t] of [['','Custom'],['PRI','Primary'],['SEC','Secondary'],['TER','Tertiary']]){const opt=el('option','',t);opt.value=v;refs.append(opt)}refs.value=['PRI','SEC','TER'].includes(value)?value:'';swatch.dataset.colorPath=JSON.stringify(path);swatch.syncColor=()=>{const stored=get(path);swatch.value=resolvedColor(stored,path);refs.value=['PRI','SEC','TER'].includes(stored)?stored:'';input.value=stored};refs.onchange=()=>{const v=refs.value||resolvedColor(get(path),path).slice(1).toUpperCase();set(path,v)};input.oninput=()=>{set(path,input.value.toUpperCase())};row.append(swatch,input,refs);if(pick)row.append(pick);wrap.append(row)}else{wrap.append(input);if(/URL$/i.test(key)){input.placeholder='https://…';wrap.classList.add('wide')}if(preservedBuiltinLogo){input.placeholder='Paste a custom logo URL to replace the built-in logo';builtinLogoBox=el('div','builtin-logo-state');const clear=el('button','','Clear built-in logo');clear.type='button';clear.onclick=e=>{e.preventDefault();preservedBuiltinLogo='';set(path,'');builtinLogoBox?.remove();builtinLogoBox=null;input.value='';input.dispatchEvent(new Event('change',{bubbles:true}));input.focus();toast('Built-in logo cleared.')};builtinLogoBox.append(clear);wrap.append(builtinLogoBox)}}}
 if(key==='name'&&path.length===3&&['teams','starTeams'].includes(path[0])){
  const team=league[path[0]]?.[path[1]],tagPath=[path[0],path[1],'tag'],baseOnInput=input.oninput;
  input.oninput=()=>{
   const previousName=String(get(path)??''),currentTag=String(get(tagPath)??''),city=String(team?.city??'');
   baseOnInput?.();
   if(!currentTag||currentTag===previousName||(city&&currentTag.toLowerCase()===city.toLowerCase())){
    set(tagPath,input.value);
    const tagSelector=JSON.stringify(tagPath);
    for(const node of document.querySelectorAll('[data-path]'))if(node.dataset.path===tagSelector)node.value=input.value;
   }
  };
 }
 if(key==='tag'&&path.length===3&&['teams','starTeams'].includes(path[0])){
  const team=league[path[0]]?.[path[1]],city=String(team?.city??'').trim(),tag=String(get(path)??'').trim(),teamName=String(team?.name??'').trim();
  if(teamName&&(!tag||(city&&tag.toLowerCase()===city.toLowerCase()))){set(path,teamName);input.value=teamName;}
 }
 if(key==='adSize'){input.readOnly=true;wrap.querySelectorAll?.('small').forEach(n=>n.remove())}
 if(key==='logoSize'&&!(path.includes('court')||path[0]==='tournamentCourts')){input.readOnly=true;wrap.querySelectorAll?.('small').forEach(n=>n.remove())}
 if(key==='logoURL'||key==='adsURL'){const hint=el('small');hint.hidden=true;wrap.append(hint);let timer;const check=async()=>{const owner=league,typed=input.value.trim(),entered=typed||(preservedBuiltinLogo&&String(get(path)??'').trim()===preservedBuiltinLogo?preservedBuiltinLogo:''),url=archiveURL(entered,assets);const sizePath=key==='adsURL'?[...path.slice(0,-1),'adSize']:null;try{if(!isCustomImage(url)){hint.hidden=true;hint.textContent='';return}hint.hidden=true;let size;if(!url){size={width:0,height:0}}else{hint.textContent='';const known=assets.find(a=>a.url===url);size=known?.width?{width:known.width,height:known.height}:await imageDimensions(url);if(key==='logoURL')validateImageSize(size)}if(league!==owner||String(get(path)??'').trim()!==entered)return;if(get(path)!==url){input.value=url;preservedBuiltinLogo='';builtinLogoBox?.remove();builtinLogoBox=null;set(path,url)}if(sizePath){if(get(sizePath)!==size.width)set(sizePath,size.width);for(const n of document.querySelectorAll('[data-path]'))if(n.dataset.path===JSON.stringify(sizePath))n.value=size.width}hint.hidden=true;hint.textContent=''}catch(e){if(league===owner&&String(get(path)??'').trim()===entered){hint.hidden=false;hint.textContent=e.message}}};input.oninput=()=>{if(preservedBuiltinLogo){if(input.value.trim()){preservedBuiltinLogo='';builtinLogoBox?.remove();builtinLogoBox=null;set(path,input.value)}}else set(path,input.value);clearTimeout(timer);timer=setTimeout(check,300)};input.onchange=()=>{clearTimeout(timer);check()};Promise.resolve().then(check)}
 if(/URL$/i.test(key))attachImagePreview(wrap,input,key);
 if(path.length===3&&path[0]==='awards'&&key==='name')input.addEventListener('input',()=>{const summary=wrap.closest('details')?.querySelector(':scope > summary');if(summary)summary.textContent=input.value||'Unnamed award'});
 if(path.length===2&&path[0]==='season'&&key==='optimization')wrap.append(el('small','','Low: custom logos, courts, table graphics, and box scores on. High: all four off.'));
 if(path.length===2&&((path[0]==='meta'&&key==='gender')||(path[0]==='season'&&key==='optimization')))wrap.classList.add('wide');
 input.setAttribute('aria-label',key==='tag'&&path.length===3&&['teams','starTeams'].includes(path[0])?'Hoop Gram Username':path.map(label).join(' / '));input.dataset.path=JSON.stringify(path);parent.append(wrap);
}
function previewBackgroundToggle(target,container){
 const button=el('button','preview-background-toggle'),normalIcon=document.createElement('img'),whiteIcon=document.createElement('img');
 button.type='button';button.setAttribute('aria-pressed','false');button.setAttribute('aria-label','Background off');button.title='Background off';
 for(const icon of [normalIcon,whiteIcon]){icon.src='./assets/images/icons/hide.png';icon.alt='';icon.setAttribute('aria-hidden','true');icon.draggable=false;icon.classList.add('preview-background-icon')}
 normalIcon.classList.add('preview-background-icon-normal');whiteIcon.classList.add('preview-background-icon-white');button.append(normalIcon,whiteIcon);
 button.onclick=event=>{event.preventDefault();event.stopPropagation();const hidden=!target.classList.contains('preview-background-hidden');target.classList.toggle('preview-background-hidden',hidden);button.setAttribute('aria-pressed',String(hidden));button.setAttribute('aria-label',hidden?'Background on':'Background off');button.title=hidden?'Background on':'Background off'};
 container.append(button);return button;
}
function attachArchiveDropdown(parent,input,key){
 const dropdown=el('details','url-archive'),summary=el('summary','','Choose from image archive');dropdown.append(summary);parent.append(dropdown);
 let built=false;
 dropdown.addEventListener('toggle',()=>{if(!dropdown.open||built)return;built=true;
  const search=el('input'),league=el('select'),count=el('p','note'),filter=el('select'),layout=el('div','url-archive-layout'),list=el('div','url-archive-list'),previewPane=el('div','url-archive-preview-pane'),preview=el('div','url-archive-hover'),apply=el('button','primary url-archive-apply','Apply image');
  let selectedAsset=null;
  apply.type='button';apply.hidden=true;
  search.type='search';search.placeholder='Search images…';search.setAttribute('aria-label','Search image archive');
  filter.setAttribute('aria-label','Archive image type');for(const name of ['All images','Logos','Courts','Ads']){const o=el('option','',name);o.value=name;filter.append(o)}filter.value=key==='adsURL'?'Ads':key==='overlayURL'?'Courts':key==='logoURL'?'Logos':'All images';
  league.setAttribute('aria-label','League Name');for(const name of ['All leagues',...new Set(assets.map(archiveLeague).filter(Boolean))]){const option=el('option','',name);option.value=name;league.append(option)}league.value='All leagues';count.setAttribute('role','status');count.setAttribute('aria-live','polite');
  dropdown.append(search,league,filter,count,layout);layout.append(list,previewPane);previewPane.append(preview,apply);
  function show(asset){preview.replaceChildren();const img=el('img');img.src=asset.local;img.alt=asset.name;preview.append(img);previewBackgroundToggle(img,preview);preview.append(el('strong','',asset.name),el('small','',[(asset.width&&asset.height)?asset.width+' × '+asset.height:'',archiveLeague(asset),asset.kind].filter(Boolean).join(' · ')))}
  function select(asset,option){if(!asset.url){toast('Image URL unavailable. Reimport this image.');return}selectedAsset=asset;for(const button of list.querySelectorAll('.url-archive-option')){button.classList.toggle('selected',button===option);button.setAttribute('aria-pressed',String(button===option))}show(asset);apply.hidden=false}
  function draw(){list.replaceChildren();preview.replaceChildren();const q=search.value.trim().toLowerCase();const matches=assets.filter(a=>(league.value==='All leagues'||archiveLeague(a)===league.value)&&(filter.value==='All images'||a.kind===filter.value)&&(a.name+' '+a.path+' '+archiveLeague(a)).toLowerCase().includes(q));
   if(selectedAsset&&!matches.includes(selectedAsset)){selectedAsset=null;apply.hidden=true}
   count.textContent=matches.length+' '+(matches.length===1?'asset':'assets')+' shown · '+assets.length+' total';
   let selectedButton=null;
   for(const asset of matches){const option=el('button','url-archive-option');option.type='button';option.setAttribute('aria-pressed','false');option.append(el('strong','',asset.name),el('small','',[archiveLeague(asset),asset.kind].filter(Boolean).join(' · ')));option.onpointerup=e=>{if(e.pointerType==='touch'||e.pointerType==='pen')select(asset,option)};option.onclick=()=>select(asset,option);if(asset===selectedAsset){option.classList.add('selected');option.setAttribute('aria-pressed','true');selectedButton=option}list.append(option)}
   if(selectedAsset&&selectedButton){show(selectedAsset);apply.hidden=false}else if(matches.length)show(matches[0]);else{apply.hidden=true;list.append(el('p','','No matching images.'))}
  }
  apply.onclick=()=>{if(!selectedAsset?.url){toast('Choose an image first.');return}input.value=selectedAsset.url;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));dropdown.open=false;input.focus();toast('Image applied.')};
  list.onkeydown=e=>{if(!['ArrowDown','ArrowUp'].includes(e.key))return;const buttons=[...list.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);if(!buttons.length)return;e.preventDefault();buttons[(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length].focus()};
  dropdown.onkeydown=e=>{if(e.key==='Escape'){dropdown.open=false;summary.focus()}};search.oninput=league.onchange=filter.onchange=draw;draw();
 });
}
function attachImagePreview(parent,input,key){
 attachArchiveDropdown(parent,input,key);
 if(key==='overlayURL')return;
 const box=el('div','image-url-preview');if(key==='overlayURL')box.classList.add('court-overlay-image-preview');box.hidden=true;parent.append(box);let timer,revision=0,resizeFrame=0,resizeObserver=null;
 const fitOverlayPreview=()=>{if(key!=='overlayURL')return;const available=Math.max(1,Math.floor(box.clientWidth||parent.clientWidth||321)),scale=Math.max(1,Math.floor(available/321)),width=321*scale,height=161*scale;box.style.setProperty('--overlay-preview-width',width+'px');box.style.setProperty('--overlay-preview-height',height+'px');const hoopCanvas=box.querySelector('.court-overlay-stage>canvas');if(hoopCanvas&&(hoopCanvas.width!==width||hoopCanvas.height!==height)){hoopCanvas.width=width;hoopCanvas.height=height;box.syncOverlayHoops?.()}};
 const queueOverlayFit=()=>{if(key!=='overlayURL')return;cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(fitOverlayPreview)};
 if(key==='overlayURL'&&'ResizeObserver'in window){resizeObserver=new ResizeObserver(queueOverlayFit);resizeObserver.observe(box)}
 else if(key==='overlayURL')window.addEventListener('resize',queueOverlayFit,{passive:true});
 const update=()=>{const current=++revision,value=input.value.trim();box.replaceChildren();delete box.dataset.courtOverlayPreview;box.syncOverlayHoops=null;box.hidden=!value;if(!value)return;
  if(!isCustomImage(value)){box.hidden=true;return}
  const url=archiveURL(value,assets);if(!safeURL(url)){box.append(el('small','','Enter a valid image URL to see a preview.'));return}
  const image=el('img'),caption=el('small','','Loading preview…');image.alt=key==='overlayURL'?'Court overlay image preview':key==='adsURL'?'Announcer table image preview':'Logo image preview';image.hidden=true;image.decoding='async';image.referrerPolicy='no-referrer';
  image.onload=()=>{if(current!==revision)return;if(key==='overlayURL')fitOverlayPreview();image.hidden=false;box.syncOverlayHoops?.();caption.hidden=true;caption.textContent=''};
  image.onerror=()=>{if(current!==revision)return;image.hidden=true;caption.hidden=false;caption.textContent='Preview unavailable. Check the image URL and sharing permissions.'};
  if(key==='overlayURL'){
   const stage=el('div','court-overlay-stage'),hoops=el('canvas');hoops.setAttribute('aria-hidden','true');stage.append(image,hoops);box.append(stage);
   box.dataset.courtOverlayPreview='true';
   box.syncOverlayHoops=()=>{if(!image.complete||!image.naturalWidth)return;const path=JSON.parse(input.dataset.path||'[]');const team=courtPreviewOwner(path.slice(0,-1));window.HLSCourtPreview?.paintHoops(hoops,team).catch(()=>{})};
  }else box.append(image);
  previewBackgroundToggle(box,box);box.append(caption);if(key==='overlayURL')fitOverlayPreview();const known=assets.find(a=>a.url===url);image.src=known?.local||url;
 };
 input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(update,300)});input.addEventListener('change',()=>{clearTimeout(timer);update()});update();
}
function entryLabel(path,key,value){
 if(path.length===2&&path[0]==='meta'&&path[1]==='generatedCountries')return value?.country||'Country '+(Number(key)+1);
 if(path.length===1&&path[0]==='awards')return value?.name||value?.shortName||'Unnamed award';
 if(path.at(-1)==='uniforms')return ['Home','Away','Alt 1','Alt 2'][key]||'Uniform '+(Number(key)+1);
 if(path.at(-1)==='facilities')return ['Medical','Training','Analytics','Arena'][value?.type]||'Unknown facility ('+value?.type+')';
 return label(key);
}
function retiredNumberField(row,title,key,value,index,scope,players,change,locked=false,selectPlayer=null){
 const wrap=el('label','field'+(key==='pid'?' retired-player-field':'')),input=el('input'),limits=key==='num'?[0,100]:key==='pid'?[0,2147483647]:[0,9999];
 wrap.append(el('span','',title));input.min=String(limits[0]);input.max=String(limits[1]);input.step='1';input.disabled=locked;input.setAttribute('aria-label',title);
 if(key==='pid'){
  const currentId=retiredNumberInteger(value),currentPlayer=players.find(player=>player.id===currentId),listId='retired-player-results-'+scope+'-'+index;
  const results=el('div','retired-player-results');results.id=listId;results.hidden=true;input.type='search';input.placeholder='Search by player name…';input.autocomplete='off';input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls',listId);input.setAttribute('aria-expanded','false');input.value=currentPlayer?.name||(currentId?String(currentId):'');
  let matches=[],active=-1;
  const restore=()=>{input.value=currentPlayer?.name||(currentId?String(currentId):'');wrap.classList.remove('invalid')};
  const close=()=>{results.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1};
  const choose=player=>{input.value=player.name;close();wrap.classList.remove('invalid');if(selectPlayer){if(selectPlayer(player)===false)restore()}else change('pid',player.id)};
  const highlight=()=>{[...results.querySelectorAll('.retired-player-result')].forEach((button,i)=>button.classList.toggle('active',i===active));if(matches[active])input.setAttribute('aria-activedescendant',listId+'-'+matches[active].id)};
  const refresh=()=>{
   matches=retiredNumberPlayerMatches(players,input.value).slice(0,12);active=matches.length?0:-1;results.replaceChildren();
   if(!input.value.trim()){close();return}
   if(!matches.length){results.append(el('p','retired-player-no-results','No matching players.'));results.hidden=false;input.setAttribute('aria-expanded','true');return}
   for(const [i,player]of matches.entries()){
    const button=el('button','retired-player-result'),info=[`ID ${player.id}`,player.status,player.age===null?'Age unavailable':'Age '+player.age,player.num===null?'Jersey number unavailable':'Jersey #'+player.num,player.teamName||'No current team'].join(' · ');button.type='button';button.id=listId+'-'+player.id;button.append(el('strong','',player.name),el('small','',info));button.onmousedown=event=>event.preventDefault();button.onclick=()=>choose(player);results.append(button);if(i===active)button.classList.add('active');
   }
   results.hidden=false;input.setAttribute('aria-expanded','true');highlight();
  };
  input.onfocus=()=>{if(input.value.trim())refresh()};input.oninput=()=>{wrap.classList.remove('invalid');refresh()};
  input.onkeydown=event=>{
   if(event.key==='Escape'){close();return}
   if(!matches.length)return;
   if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();active=(active+(event.key==='ArrowDown'?1:-1)+matches.length)%matches.length;highlight()}
   if(event.key==='Enter'&&active>=0){event.preventDefault();choose(matches[active])}
  };
  input.onchange=()=>{
   const raw=input.value.trim(),normalized=raw.toLocaleLowerCase(),exact=players.find(player=>player.name.toLocaleLowerCase()===normalized);
   if(exact){choose(exact);return}
   if(raw===''){close();if(change('pid',0)===false)restore();return}
   wrap.classList.add('invalid');restore();
  };
  input.onblur=()=>setTimeout(()=>{if(!results.contains(document.activeElement)&&!results.hidden)input.onchange();close()},180);wrap.append(input,results);
 }else{
  input.type='number';input.value=String(retiredNumberInteger(value));wrap.append(input);
  input.onchange=()=>{const next=Number(input.value);if(!Number.isInteger(next)||next<limits[0]||next>limits[1]){wrap.classList.add('invalid');return}if(change(key,next)===false){input.value=String(retiredNumberInteger(value));return}wrap.classList.remove('invalid')};
 }
 row.append(wrap);return input;
}
function renderRetiredNumberRow(parent,entry,index,entries,scope,change,remove,locked=false,selectPlayer=null){
 const row=el('div','retired-number-row'),players=retiredNumberPlayers();
 retiredNumberField(row,'Player Name','pid',entry.pid,index,scope,players,change,locked,selectPlayer);
 retiredNumberField(row,'Number','num',entry.num,index,scope,players,change,locked);
 retiredNumberField(row,'Year Number Retired','yr',entry.yr,index,scope,players,change,locked);
 const button=el('button','retired-number-remove',locked?'League-wide':'Remove');button.type='button';button.disabled=locked;button.setAttribute('aria-label',(locked?'League-wide retired number ':'Remove retired number ')+(entry.num??''));button.onclick=remove;row.append(button);parent.append(row);
}
function renderLeagueRetiredNumbers(parent){
 const section=el('details','retired-numbers-editor'),summary=el('summary',''),help=el('p','retired-numbers-help','Add a league-wide retired number to apply it to every team that hasn’t already retired it. Search by player name to auto-fill the player ID, jersey number, and retirement year.'),list=el('div','retired-numbers-list'),actions=el('div','retired-numbers-actions'),add=el('button','primary','Add League-wide Number');add.type='button';actions.append(add);section.append(summary,help,list,actions);parent.append(section);
 const draw=()=>{const entries=leagueRetiredNumbers();summary.textContent='Retired Numbers · '+entries.length;list.replaceChildren();if(!entries.length)list.append(el('p','retired-number-empty','No league-wide numbers.'));for(const [index,entry]of entries.entries())renderRetiredNumberRow(list,entry,index,entries,'league',(key,value)=>{if(key==='num'&&entries.some((candidate,i)=>i!==index&&retiredNumberInteger(candidate.num)===value)){toast('That number is already retired league-wide.');return false}const next=entries.map((candidate,i)=>i===index?{...candidate,[key]:value}:candidate);setLeagueRetiredNumbers(next);draw()},()=>{setLeagueRetiredNumbers(entries.filter((_,i)=>i!==index));draw()},false,player=>{const number=retiredNumberPlayerNumber(player);if(number!==null&&entries.some((candidate,i)=>i!==index&&retiredNumberInteger(candidate.num)===number)){toast('That player jersey number is already retired league-wide.');return false}const next=entries.map((candidate,i)=>i===index?{...candidate,pid:player.id,num:number===null?candidate.num:number,yr:player.yearRetired||retiredNumberInteger(candidate.yr)||defaultRetiredNumberYear()}:candidate);setLeagueRetiredNumbers(next);draw();return true})};
 add.onclick=()=>{const entries=leagueRetiredNumbers(),allNumbers=[...entries,...retiredNumberTeams().flatMap(team=>team.retiredNumbers||[])],next=[...entries,{num:nextRetiredNumber(allNumbers),pid:0,yr:defaultRetiredNumberYear()}];setLeagueRetiredNumbers(next);section.open=true;draw()};draw();
}
function renderTeamRetiredNumbers(parent,team,path){
 const section=el('details','retired-numbers-editor'),summary=el('summary',''),globalNumbers=()=>new Set(leagueRetiredNumbers().map(entry=>retiredNumberInteger(entry.num))),help=el('p','retired-numbers-help'),list=el('div','retired-numbers-list'),actions=el('div','retired-numbers-actions'),add=el('button','primary','Add Retired Number');add.type='button';actions.append(add);section.append(summary,help,list,actions);parent.append(section);
 const draw=()=>{const entries=Array.isArray(team.retiredNumbers)?team.retiredNumbers:[],leagueNumbers=globalNumbers();summary.textContent='Retired Numbers · '+entries.length;help.textContent=leagueNumbers.size?'League-wide retired numbers are read-only here. Search by player name to auto-fill the player ID, jersey number, and retirement year.':'Add a retired number for this team. Search by player name to auto-fill the player ID, jersey number, and retirement year.';list.replaceChildren();if(!entries.length)list.append(el('p','retired-number-empty','No retired numbers for this team.'));for(const [index,entry]of entries.entries()){const locked=leagueNumbers.has(retiredNumberInteger(entry.num));renderRetiredNumberRow(list,entry,index,entries,'team-'+team.id,(key,value)=>{if(locked)return false;if(key==='num'&&entries.some((candidate,i)=>i!==index&&retiredNumberInteger(candidate.num)===value)){toast('That number is already retired for this team.');return false}set([...path,index,key],value)},()=>{if(locked)return;set(path,entries.filter((_,i)=>i!==index));draw()},locked,player=>{if(locked)return false;const number=retiredNumberPlayerNumber(player);if(number!==null&&entries.some((candidate,i)=>i!==index&&retiredNumberInteger(candidate.num)===number)){toast('That player jersey number is already retired for this team.');return false}const next=entries.map((candidate,i)=>i===index?{...candidate,pid:player.id,num:number===null?candidate.num:number,yr:player.yearRetired||retiredNumberInteger(candidate.yr)||defaultRetiredNumberYear()}:candidate);set(path,next);draw();return true})}};
 add.onclick=()=>{const entries=Array.isArray(team.retiredNumbers)?team.retiredNumbers:[],allNumbers=[...entries,...leagueRetiredNumbers()],next=[...entries,{num:nextRetiredNumber(allNumbers),pid:0,yr:defaultRetiredNumberYear()}];set(path,next);section.open=true;draw()};draw();
}
function resetLeagueYearsPro(data){
 if(data.leagueType!==0)return 0;
 const players=[...(data.teams||[]),...(data.starTeams||[])].flatMap(team=>team.roster||[]);
 for(const key of ['freeAgents','draftClass','retirees','hallOfFame','threePointContestants'])players.push(...(data[key]||[]));
 let changed=0;
 for(const player of new Set(players))if(player.yrs!==0){player.yrs=0;changed++}
 return changed;
}
const seasonGroups={
 General:['startingYear','totalGames','divisionGames','conferenceGames','nonConferenceGames'],
 Advanced:['injuryProbability','HOFbar','simulationPace','progressionRate','ageAppearance','cpuTrading','generatedFreeAgents','hidePotential'],
 'Game Setup':[],
 Draft:['lotteryTeams','lotteryOdds','fantasyDraft'],
 Playoffs:['playoffTeams','seriesLength','playInTournament'],
 Salary:['salaryCap','maxContract'],
 Optimization:[],
 Commissioner:['cpuRosterChanges','cpuTradeBlock','cpuProgression','overrideCPU','autoTradeApproval','injuries','regression']
};
function enforcePlayInRounds(data){if(!data.season?.playInTournament)return;const rounds=data.season.seriesLength||[];data.season.seriesLength=[...Array.from({length:4},(_,i)=>rounds[i]??3),1,1]}
function renderPlayoffs(parent){
 const college=league.leagueType===1,host=el('div');parent.append(host);
 function draw(){host.replaceChildren();const fields=el('div','fields');host.append(fields);field(fields,'playoffTeams',league.season.playoffTeams,['season','playoffTeams']);const count=el('p','note');count.dataset.playoffCount='true';count.syncCount=()=>{const conferences=league.leagueType===1?league.divisions.length:2,total=league.season.playoffTeams;count.textContent=total+(college?' tournament teams · ':' playoff teams · ')+(total/conferences)+' per conference'+(total%conferences?' — choose a total divisible by '+conferences:'')};count.syncCount();host.append(count);
 if(!college){const toggle=el('label','field'),check=el('input');check.type='checkbox';check.checked=league.season.playInTournament;toggle.append(el('span','','Play-in Tournament'),check);host.append(toggle);check.onchange=()=>{set(['season','playInTournament'],check.checked);enforcePlayInRounds(league);draw()}}
 host.append(el('h3','','Round Length'));const rounds=league.season.seriesLength||[],offset=0,names=college?['First Round','Top 8','Top 4','Championship']:['First Round','Conference Semi-Final','Conference Finals','Finals'],choices=['Single Elimination','Best of 3','Best of 5','Best of 7'];const rows=el('div','fields');host.append(rows);

 for(let i=0;i<4;i++){const row=el('label','field'),select=el('select');row.append(el('span','',names[i]));choices.forEach((name,value)=>{const o=el('option','',name);o.value=String(value+1);select.append(o)});select.value=String(rounds[offset+i]??3);select.setAttribute('aria-label',names[i]+' round length');select.onchange=()=>set(['season','seriesLength',offset+i],Number(select.value));row.append(select);rows.append(row)}
 }draw();
}
function renderDraft(parent,season){
 const controls=el('div','lottery-controls');controls.dataset.lotteryControls='true';parent.append(controls);
 const switches=[];
 for(const [key,title]of [['teams','Auto lottery teams'],['odds','Auto weighted odds']]){
  const wrap=el('label','lottery-toggle'),input=el('input');input.type='checkbox';wrap.append(input,el('span','',title));controls.append(wrap);switches.push([key,input]);
  input.onchange=()=>{lotteryMode(league)[key]=input.checked;applyLotteryDefaults(league);syncSettingFields();odds.syncOdds();controls.syncLottery();dirty=true;$('#status').textContent='Unsaved changes'};
 }
 controls.syncLottery=()=>{for(const [key,input]of switches){input.checked=lotteryMode(league)[key];input.disabled=league.leagueType!==0}};controls.syncLottery();
 const fields=el('div','fields');parent.append(fields);
 for(const key of ['lotteryTeams','fantasyDraft'])if(Object.hasOwn(season,key))field(fields,key,season[key],['season',key]);
 const odds=el('details'),summary=el('summary'),rows=el('div','fields');odds.dataset.lotteryOdds='true';odds.append(summary,rows);parent.append(odds);
 odds.syncOdds=()=>{
  const count=Math.max(0,Math.floor(Number(season.lotteryTeams)||0));
  summary.textContent='Lottery Odds · '+count+' teams';rows.replaceChildren();
  if(!Array.isArray(season.lotteryOdds))season.lotteryOdds=[];
  for(let i=0;i<count;i++){if(season.lotteryOdds[i]==null)season.lotteryOdds[i]=0;field(rows,String(i),season.lotteryOdds[i],['season','lotteryOdds',i])}
 };odds.syncOdds();
}
function renderSeason(parent,obj){
 const nav=el('div','season-tabs'),body=el('div');nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Season settings');parent.append(nav,body);
 const tabs=[],panels=[];
 function drawFields(panel,source,keys,path){
  const subset=Object.fromEntries(keys.filter(k=>Object.hasOwn(source,k)).map(k=>[k,source[k]]));
  renderObject(panel,subset,path,0,true);
 }
 for(const [title,keys]of Object.entries(seasonGroups)){
  if(title==='Commissioner'||(league.leagueType===1&&['Draft','Salary'].includes(title)))continue;
  const index=tabs.length,button=el('button','',league.leagueType===1&&title==='Playoffs'?'Tournament':title),panel=el('div','season-panel');
  button.type='button';button.id='season-tab-'+index;button.setAttribute('role','tab');button.setAttribute('aria-controls','season-panel-'+index);
  panel.id='season-panel-'+index;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);
  tabs.push(button);panels.push(panel);nav.append(button);body.append(panel);
  if(title==='Game Setup')renderObject(panel,league.settings||{},['settings']);
  else if(title==='Playoffs')renderPlayoffs(panel);
  else if(title==='Draft')renderDraft(panel,obj);
  else if(title==='Salary'){const capFields=el('div','fields');panel.append(capFields);if(Object.hasOwn(obj,'salaryCap'))field(capFields,'salaryCap',obj.salaryCap,['season','salaryCap']);panel.append(el('h3','salary-max-heading','Max Contract'));const maxFields=el('div','fields salary-max-fields');panel.append(maxFields);for(const [i,value]of (obj.maxContract||[]).entries())field(maxFields,String(i),value,['season','maxContract',i])}
  else if(title==='Optimization'){const preset=el('div','fields');panel.append(preset);if(Object.hasOwn(obj,'optimization'))field(preset,'optimization',obj.optimization,['season','optimization']);renderOptimization(panel)}
  else if(title==='General'){drawFields(panel,obj,keys,['season']);const generalFields=panel.querySelector(':scope > .fields');if(generalFields){const teamCount=renderTeamCountControl(generalFields);generalFields.insertBefore(teamCount,generalFields.children[1]||null)}}
  else drawFields(panel,obj,league.leagueType===1?keys.filter(key=>key!=='HOFbar'):keys,['season']);

  if(title==='General'){const genderFields=el('div','fields season-gender-fields');panel.append(genderFields);if(league.meta&&Object.hasOwn(league.meta,'gender'))field(genderFields,'gender',league.meta.gender,['meta','gender'])}
  if(title==='General'){
   const regenerate=el('button','season-regenerate', 'Regenerate Rosters & Personnel');regenerate.type='button';regenerate.onclick=async()=>{
    if(!canNavigate()||!confirm('Regenerate every roster and staff group? This replaces the current players and personnel while keeping league settings, divisions, and team identities.'))return;
    regenerate.disabled=true;$('#status').textContent='Regenerating rosters and personnel…';
    try{const next=await regenerateLeagueRosters();load(next,true);render();toast('Generated new rosters and personnel for all '+next.teams.length+' teams.')}catch(error){toast(error.message);alert(error.message)}finally{regenerate.disabled=false}
   };
   const rosterActions=el('div','season-roster-actions');rosterActions.append(regenerate);panel.append(rosterActions);
   if(league.leagueType===0){
    const reset=el('button','season-reset-years-pro','Reset Years Pro');reset.type='button';
    reset.title='Set every player’s Years Pro to 0. Ages, ratings, stats, and awards stay unchanged.';
    reset.onclick=()=>{
     if(!canNavigate())return;
     const changed=resetLeagueYearsPro(league);
     if(changed){dirty=true;$('#status').textContent='Unsaved changes'}
     toast(changed?'Reset all player Years Pro values to 0.':'All player Years Pro values are already 0.');
    };
    rosterActions.append(reset);
   }
   const teamStatus=el('p','',league.teams.length+' teams · '+(league.awards||[]).filter(a=>a.enabled).length+' enabled awards');teamStatus.dataset.teamCountStatus='true';panel.append(teamStatus);
  }
  button.onclick=()=>{if(!canNavigate())return;activate(index)};
  button.onkeydown=e=>{let next;if(e.key==='ArrowRight')next=(index+1)%tabs.length;if(e.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;if(e.key==='Home')next=0;if(e.key==='End')next=tabs.length-1;if(next!==undefined){e.preventDefault();if(canNavigate()){activate(next);tabs[next].focus()}}};
 }
 function activate(index){tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;panels[i].hidden=i!==index})}
 activate(0);
}
function orderedFields(obj,path){const entries=Object.entries(obj);if(path.length)return entries;const typeIndex=entries.findIndex(e=>e[0]==='leagueType');if(typeIndex>=0){const [type]=entries.splice(typeIndex,1);const nameIndex=entries.findIndex(e=>e[0]==='leagueName');entries.splice(nameIndex<0?0:nameIndex,0,type)}const season=entries.find(e=>e[0]==='season');if(!season)return entries;const rest=entries.filter(e=>e[0]!=='season');const index=rest.findIndex(e=>e[0]==='meta');rest.splice(index<0?0:index,0,season);return rest}
function isEmptyAward(a){return !a.enabled&&(!a.name?.trim()||/^CUSTOM AWARD$/i.test(a.name.trim()))&&!Object.entries(a).some(([k,v])=>typeof v==='number'&&!['id','maxStarted'].includes(k)&&v!==0)&&!['primaryC','secondaryC','baseC','plateC','nameC'].some(k=>a[k]);}
function renderAwards(parent){
 const host=el('div');parent.append(host);
 function draw(openIndex=-1){host.replaceChildren();const awards=league.awards||[],visible=awards.map((a,i)=>({a,i})).filter(({a})=>!isEmptyAward(a));host.append(el('p','note',visible.length+' / 24 awards'));
 const add=el('button','primary','Add Award');add.type='button';add.disabled=visible.length>=24;host.append(add);
 add.onclick=()=>{if(!canNavigate())return;const current=league.awards||[];if(current.filter(a=>!isEmptyAward(a)).length>=24)return;let index=current.findIndex(isEmptyAward);if(index<0&&current.length>=24){toast('The league already has 24 award slots.');return}const template=standaloneSample.awards.find(isEmptyAward);const award=structuredClone(template);award.id=index>=0?current[index].id:Math.max(-1,...current.map(a=>a.id))+1;award.name='New Award';award.shortName='NEW';award.enabled=true;const next=current.slice();if(index<0)index=next.length;next[index]=award;set(['awards'],next);draw(index)};
 for(const {a,i}of visible){const section=el('details','award-shell');section.append(el('summary','',a.name||'Unnamed award'));host.append(section);section.addEventListener('toggle',()=>{if(!section.open||section.dataset.built)return;section.dataset.built='1';const remove=el('button','','Remove Award');remove.type='button';remove.onclick=()=>{if(!canNavigate()||!confirm('Remove '+(a.name||'this award')+'?'))return;const next=league.awards.slice();const empty=structuredClone(standaloneSample.awards.find(isEmptyAward));empty.id=a.id;next[i]=empty;set(['awards'],next);draw()};section.append(remove);renderAwardEditor(section,a,['awards',String(i)],{el,field,get,set,resolveColor:resolvedColor,leagueType:league.leagueType})});if(i===openIndex)section.open=true;}
 }draw();
}
function renderCountries(parent,path){
 const host=el('div','country-grid');parent.append(host);
 function draw(){host.replaceChildren();const countries=get(path);
  const balance=el('p','note');balance.dataset.countryBalance='true';balance.syncBalance=()=>{const total=get(path).reduce((sum,c)=>sum+(Number(c.value)||0),0),remaining=Number((100-total).toFixed(6));balance.textContent=remaining>=0?'Unassigned: '+remaining+'%':'Over allocated: '+(-remaining)+'%'};balance.syncBalance();host.append(balance);
  const toolbar=el('div','country-toolbar'),add=el('button','primary','Add Country'),reset=el('button','','Reset Countries');add.type=reset.type='button';add.disabled=countries.length>=11;toolbar.append(el('span','',countries.length+' / 11 countries'),add,reset);host.append(toolbar);
  reset.onclick=async()=>{if(!canNavigate())return;const owner=league,type=league.leagueType;reset.disabled=true;try{const assets=await loadGenerationAssets();if(league!==owner||league.leagueType!==type||!reset.isConnected)return;const defaults=structuredClone(assets[5][type===1?'college':'pro'].meta.generatedCountries);host.replaceChildren();set(path,defaults);draw();toast('Default countries and percentages restored.')}catch(error){toast(error.message||'Could not reset countries.')}finally{reset.disabled=false}};
  add.onclick=()=>{if(!canNavigate())return;const current=get(path);if(current.length>=11)return;const next=hoopLandCountries.find(([code])=>!current.some(c=>c.country===code));if(!next)return;set(path,[...current,{country:next[0],value:0}]);draw();toast('Country added at 0%. Choose a country and assign its percentage.')};
  for(const [i,country]of countries.entries()){
   const row=el('div','country-entry');host.append(row);renderObject(row,country,[...path,i]);
   const remove=el('button','','Remove');remove.type='button';remove.disabled=countries.length<=1;remove.setAttribute('aria-label','Remove '+(country.country||'country '+(i+1)));if(remove.disabled)remove.title='Keep at least one country.';
   remove.onclick=()=>{if(!canNavigate())return;try{const next=get(path).filter((_,index)=>index!==i);host.replaceChildren();set(path,next);draw();toast('Country removed. Assign its percentage to the remaining countries.')}catch(error){draw();toast(error.message)}};remove.classList.add('remove-country');const countryField=row.querySelector('select')?.closest('.field');if(countryField){const selector=countryField.querySelector('select'),controls=el('div','country-selector-actions');controls.append(selector,remove);countryField.append(controls)}else row.append(remove);
  }
  if(!countries.length)host.append(el('p','','No countries in this league.'));
 }
 draw();
}
function teamGeoPoint(team){
 const x=Number(team?.location?.x),y=Number(team?.location?.y);
 return Number.isFinite(x)&&Number.isFinite(y)?{x,y}:null;
}

function balancedGeographicGroups(entries,count){
 const groups=Array.from({length:count},()=>[]);
 if(!count||!entries.length)return groups;

 const base=Math.floor(entries.length/count),remainder=entries.length%count;
 const capacities=Array.from({length:count},(_,i)=>base+(i<remainder?1:0));
 const located=[],missing=[];

 for(const entry of entries){
  const point=teamGeoPoint(entry.team);
  if(point)located.push({...entry,x:point.x,y:point.y});
  else missing.push(entry);
 }

 function partition(items,caps,offset){
  if(!caps.length||!items.length)return;
  if(caps.length===1){groups[offset].push(...items);return}

  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const item of items){
   if(item.x<minX)minX=item.x;if(item.x>maxX)maxX=item.x;
   if(item.y<minY)minY=item.y;if(item.y>maxY)maxY=item.y;
  }
  const axis=(maxX-minX)>=(maxY-minY)?'x':'y',other=axis==='x'?'y':'x';
  const sorted=[...items].sort((a,b)=>a[axis]-b[axis]||a[other]-b[other]||a.i-b.i);

  const leftGroups=Math.floor(caps.length/2);
  const leftCaps=caps.slice(0,leftGroups),rightCaps=caps.slice(leftGroups);
  const leftCapacity=leftCaps.reduce((sum,n)=>sum+n,0),totalCapacity=leftCapacity+rightCaps.reduce((sum,n)=>sum+n,0);
  const leftCount=Math.max(0,Math.min(sorted.length,Math.round(sorted.length*(leftCapacity/totalCapacity))));

  partition(sorted.slice(0,leftCount),leftCaps,offset);
  partition(sorted.slice(leftCount),rightCaps,offset+leftGroups);
 }

 partition(located,capacities,0);

 for(const entry of missing){
  let target=0,bestDeficit=capacities[0]-groups[0].length;
  for(let g=1;g<count;g++){
   const deficit=capacities[g]-groups[g].length;
   if(deficit>bestDeficit){target=g;bestDeficit=deficit}
  }
  if(bestDeficit<=0){
   for(let g=1;g<count;g++)if(groups[g].length<groups[target].length)target=g;
  }
  groups[target].push(entry);
 }

 return groups;
}

function leagueStructurePlan(data,conferenceCount,perConference){
 if(data.leagueType===1){
  if(![2,4,6,8].includes(conferenceCount))throw Error('College leagues use 2, 4, 6, or 8 conferences.');
  const oldConferenceCount=data.divisions.length;
  const divisions=Array.from({length:conferenceCount},(_,i)=>data.divisions[i]||'Conference '+(i+1)),moves=[];

  for(const type of ['teams','starTeams']){
   const entries=(data[type]||[]).map((team,i)=>({team,i}));

   if(conferenceCount!==oldConferenceCount){
    const groups=balancedGeographicGroups(entries,conferenceCount);
    for(let c=0;c<groups.length;c++){
     for(const item of groups[c])if(item.team?.division!==c)moves.push({type,i:item.i,division:c});
    }
    continue;
   }

   const counts=Array(conferenceCount).fill(0),invalid=[];
   for(const item of entries){
    const d=item.team?.division;
    if(Number.isInteger(d)&&d>=0&&d<conferenceCount)counts[d]++;
    else invalid.push(item);
   }
   for(const item of invalid){
    let target=0;
    for(let c=1;c<conferenceCount;c++)if(counts[c]<counts[target])target=c;
    moves.push({type,i:item.i,division:target});
    counts[target]++;
   }
  }
  return {conferences:[...data.conferences],divisions,moves};
 }

 if(data.leagueType===0&&(conferenceCount!==2||![1,2,3,4].includes(perConference)))throw Error('Pro leagues use 2 conferences and 2, 4, 6, or 8 total divisions.');
 if(!Number.isInteger(conferenceCount)||conferenceCount<1||!Number.isInteger(perConference)||perConference<1||conferenceCount*perConference>256)throw Error('Use positive whole numbers, with at most 256 divisions.');

 const oldPer=data.conferences.length&&data.divisions.length%data.conferences.length===0?data.divisions.length/data.conferences.length:0;
 const conferences=Array.from({length:conferenceCount},(_,i)=>data.conferences[i]||'Conference '+(i+1));
 const divisions=[];
 for(let c=0;c<conferenceCount;c++){
  for(let d=0;d<perConference;d++){
   divisions.push((oldPer&&d<oldPer?data.divisions[c*oldPer+d]:!oldPer?data.divisions[c*perConference+d]:null)||'Division '+(c*perConference+d+1));
  }
 }

 const moves=[];
 for(const type of ['teams','starTeams']){
  const entries=(data[type]||[]).map((team,i)=>({team,i}));

  if(perConference!==oldPer){
   const conferenceBuckets=Array.from({length:conferenceCount},()=>[]),unassigned=[];

   if(oldPer){
    for(const item of entries){
     const old=item.team?.division;
     if(Number.isInteger(old)&&old>=0&&old<data.divisions.length){
      const conference=Math.floor(old/oldPer);
      if(conference>=0&&conference<conferenceCount){
       conferenceBuckets[conference].push(item);
       continue;
      }
     }
     unassigned.push(item);
    }
   }else{
    const geoConferences=balancedGeographicGroups(entries,conferenceCount);
    for(let c=0;c<conferenceCount;c++)conferenceBuckets[c].push(...geoConferences[c]);
   }

   for(const item of unassigned){
    let target=0;
    for(let c=1;c<conferenceCount;c++)if(conferenceBuckets[c].length<conferenceBuckets[target].length)target=c;
    conferenceBuckets[target].push(item);
   }

   for(let c=0;c<conferenceCount;c++){
    const divisionGroups=balancedGeographicGroups(conferenceBuckets[c],perConference);
    for(let d=0;d<divisionGroups.length;d++){
     const target=c*perConference+d;
     for(const item of divisionGroups[d]){
      if(item.team?.division!==target)moves.push({type,i:item.i,division:target});
     }
    }
   }
   continue;
  }

  const counts=Array(conferenceCount*perConference).fill(0),invalid=[];
  for(const item of entries){
   const old=item.team?.division;
   if(Number.isInteger(old)&&old>=0&&old<counts.length)counts[old]++;
   else invalid.push(item);
  }
  for(const item of invalid){
   let target=0;
   for(let d=1;d<counts.length;d++)if(counts[d]<counts[target])target=d;
   moves.push({type,i:item.i,division:target});
   counts[target]++;
  }
 }

 return {conferences,divisions,moves};
}
function renderLeagueStructure(parent){
 const college=league.leagueType===1,section=el('details');section.append(el('summary','',college?'Conferences':'Conferences & Divisions'));parent.append(section);const host=el('div');section.append(host);
 function draw(){host.replaceChildren();renderTeamDistributionSummary(host);const wrap=el('div','field'),row=el('div','number-control'),input=el('input'),minus=el('button','','−'),plus=el('button','','+');const title=college?'Total Conferences':'Total Divisions';wrap.append(el('span','',title));input.type='number';input.min='2';input.max='8';input.step='2';input.value=league.divisions.length;input.setAttribute('aria-label',title);minus.type=plus.type='button';minus.setAttribute('aria-label','Decrease '+title);plus.setAttribute('aria-label','Increase '+title);row.append(minus,input,plus);wrap.append(row);host.append(wrap);
 if(!college)host.append(el('p','','Pro leagues have 2 conferences. Choose 2, 4, 6, or 8 total divisions.'));
 const preview=el('p','note'),apply=el('button','primary','Apply Structure');apply.type='button';host.append(preview,apply);
 const plan=()=>leagueStructurePlan(league,college?Number(input.value):2,college?1:Number(input.value)/2);
 const describe=()=>{try{const next=plan();preview.textContent=next.divisions.length+(college?' conferences':' divisions across 2 conferences')+' · '+next.moves.length+' team assignments will change.';apply.disabled=false}catch(e){preview.textContent=e.message;apply.disabled=true}minus.disabled=Number(input.value)<=2;plus.disabled=Number(input.value)>=8};input.oninput=describe;minus.onclick=()=>{input.value=String(Math.max(2,Math.ceil(Number(input.value)/2)*2-2));describe()};plus.onclick=()=>{input.value=String(Math.min(8,Math.floor(Number(input.value)/2)*2+2));describe()};describe();
 apply.onclick=()=>{if(!canNavigate())return;const next=plan();set(['conferences'],next.conferences);set(['divisions'],next.divisions);for(const move of next.moves)set([move.type,move.i,'division'],move.division);draw();listTeams();toast('League structure updated.')};
 if(college){
  const names=el('div','fields');host.append(names);
  for(const [i,name]of league.divisions.entries())field(names,'Conference '+(i+1),name,['divisions',i]);
 }else{
  const list=el('div','conference-structure-list');host.append(list);
  const conferenceCount=Math.max(1,league.conferences.length),perConference=Math.ceil(league.divisions.length/conferenceCount);
  for(let c=0;c<conferenceCount;c++){
   const group=el('div','conference-structure-group');list.append(group);
   const conferenceField=el('div','conference-structure-conference');group.append(conferenceField);
   field(conferenceField,'Conference '+(c+1),league.conferences[c]||'Conference '+(c+1),['conferences',c]);
   const divisions=el('div','conference-structure-divisions');group.append(divisions);
   const start=c*perConference,end=Math.min(start+perConference,league.divisions.length);
   for(let i=start;i<end;i++)field(divisions,'Division '+(i+1),league.divisions[i],['divisions',i]);
  }
 }
 }draw();
}

function renderFacilities(parent,facilities,path){
 const section=el('div','facility-editor');
 section.append(el('h3','facility-editor-heading','Facilities'));
 const names=['Medical','Training','Analytics','Arena'];
 const ordered=[...(facilities||[]).entries()].sort((a,b)=>{
  const av=Number(a[1]?.type),bv=Number(b[1]?.type);
  return (Number.isFinite(av)?av:99)-(Number.isFinite(bv)?bv:99);
 });
 for(const [index,facility] of ordered){
  if(!facility||typeof facility!=='object')continue;
  const type=Number(facility.type),title=names[type]||('Facility '+(index+1));
  const row=el('div','facility-tier-row'),heading=el('strong','facility-tier-name',title);
  const control=el('div','number-control facility-tier-control'),minus=el('button','','−'),input=el('input'),plus=el('button','','+');
  minus.type=plus.type='button';input.type='number';input.min='0';input.max='4';input.step='1';
  input.value=String(Number.isFinite(Number(facility.tier))?facility.tier:0);
  input.setAttribute('aria-label',title+' Tier');
  minus.setAttribute('aria-label','Decrease '+title+' Tier');plus.setAttribute('aria-label','Increase '+title+' Tier');
  const tierPath=[...path,index,'tier'];
  const sync=()=>{const value=Math.max(0,Math.min(4,Number(get(tierPath))||0));input.value=String(value);minus.disabled=value<=0;plus.disabled=value>=4};
  const update=value=>{const next=Math.max(0,Math.min(4,Math.round(Number(value)||0)));set(tierPath,next);sync()};
  minus.onclick=()=>update(Number(get(tierPath))-1);plus.onclick=()=>update(Number(get(tierPath))+1);
  input.onchange=()=>update(input.value);input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();input.blur()}};
  control.append(minus,input,plus);row.append(heading,control);section.append(row);sync();
 }
 if(!section.children.length)section.append(el('p','','No facilities in this team.'));
 parent.append(section);
}
const tournamentRounds=[['firstRound','First Round'],['secondRound','Second Round'],['top16','Top 16'],['top8','Top 8'],['top4','Top 4'],['championship','Championship']];
function tournamentDefaultCourt(){return window.HLSTournamentCourts.defaultCourt(league,standaloneSample.teams[0].court)}
function tournamentCourt(round){return window.HLSTournamentCourts.customCourt(league,round)||tournamentDefaultCourt()}
function courtPreviewOwner(path){
 if(path[0]==='tournamentCourts')return {...league.teams?.[0],name:league.leagueName,logoURL:league.logoURL||'',court:tournamentCourt(path[1])};
 return get(path.slice(0,-1));
}
function renderTournamentCourts(parent){
 if(league.leagueType!==1)return;
 const disclosure=el('details','tournament-courts-disclosure'),section=el('section','tournament-courts'),grid=el('div','tournament-court-grid');section.id='tournament-courts';disclosure.append(el('summary','','Tournament Courts'),section);parent.append(disclosure);
 section.append(grid);
 for(const [round,label]of tournamentRounds){
  const card=el('button','tournament-court-card'),preview=el('div');card.type='button';card.dataset.round=round;card.setAttribute('aria-label','Edit '+label+' court');
  card.append(el('span','tournament-court-label',label),preview,el('span','tournament-court-status',window.HLSTournamentCourts.customCourt(league,round)?'Custom court':'League default'));
  grid.append(card);window.HLSCourtPreview?.mount(preview,()=>courtPreviewOwner(['tournamentCourts',round]));
  preview.querySelector('[tabindex]')?.removeAttribute('tabindex');
  card.onclick=()=>{
   if(!canNavigate())return;
   const scrollNodes=[document.scrollingElement,...document.querySelectorAll('main, .main, #content')];
   const scroll=scrollNodes.filter(Boolean).map(node=>[node,node.scrollTop]);
   const original=league.tournamentCourts?.[round],wasDirty=dirty,hadCourts=Object.hasOwn(league,'tournamentCourts'),beforeEdit=JSON.stringify(league);
   league.tournamentCourts||={};league.tournamentCourts[round]=structuredClone(tournamentCourt(round));
   section.replaceChildren();section.append(el('h2','',label+' Court'));
   const actions=el('div','tournament-court-actions'),back=el('button','','Back'),save=el('button','','Save court');back.type=save.type='button';actions.append(back,save);section.append(actions);
   const finish=commit=>{
    if(commit&&!canNavigate())return;
    if(commit)set(['tournamentCourts',round],league.tournamentCourts[round]);
    else {if(original===undefined)delete league.tournamentCourts[round];else league.tournamentCourts[round]=original;if(!hadCourts&&!Object.keys(league.tournamentCourts).length)delete league.tournamentCourts;dirty=wasDirty||JSON.stringify(league)!==beforeEdit;$('#status').textContent=dirty?'Unsaved changes':'Ready to edit'}
    render();document.querySelector('.tournament-courts-disclosure').open=true;requestAnimationFrame(()=>{document.querySelector('[data-round="'+round+'"]').focus({preventScroll:true});for(const [node,top]of scroll)if(node.isConnected)node.scrollTop=top});
   };
   back.onclick=()=>finish(false);save.onclick=()=>finish(true);
   renderCourtEditor(section,league.tournamentCourts[round],['tournamentCourts',round]);
   section.scrollIntoView({block:'start'});back.focus({preventScroll:true});
  };
 }
}
function renderCourtEditor(parent,court,path){
 const editor=el('div','court-editor'),preview=el('div','court-editor-preview'),controls=el('div','court-editor-controls');
 parent.append(editor);editor.append(preview,controls);window.HLSCourtPreview?.mount(preview,()=>courtPreviewOwner(path));
 const groups=[
 ['Wood',['outerWood','outerWoodC','innerWood','innerWoodC']],
 ['Paint',['outerFT','outerFTC','innerFT','innerFTC','outerKey','outerKeyC','innerKey','innerKeyC']],
 ['Floor & borders',['outerBorder','innerBorder','outerFloor']],
 ['Court lines',['mediaLines','outerLine','halfCourtLine','threePointLine','threePointLineC','outerFTCircle','innerFTCircle','outerKeyLine','innerKeyLine']],
 ['Logo & Overlay',['logoSize','logoLayer','overlayURL','overlayLayer']],
 ['Court text',['baseline1','baseline1C','baseline2','baseline2C','sideline1','sideline1C','sideline2','sideline2C']],
 ['Hoops',['hoopBase','hoopPole','polePadding','hoopPadding']]];
 const known=new Set(groups.flatMap(g=>g[1])),extra=Object.keys(court).filter(k=>!known.has(k));if(extra.length)groups.push(['Other',extra]);
 for(const [title,keys]of groups){const section=el('details','court-settings-section'),summary=el('summary','',title),panel=el('div','fields court-editor-panel');panel.setAttribute('role','group');panel.setAttribute('aria-label',title);section.append(summary,panel);controls.append(section);for(const key of keys)if(Object.hasOwn(court,key))field(panel,key,court[key],[...path,key]);}

}
function renderObject(parent,obj,path,depth=0,seasonSubset=false){if(path.length===3&&path[2]==='court'&&['teams','starTeams'].includes(path[0])){renderCourtEditor(parent,obj,path);return}if(path.length===3&&path.at(-1)==='uniforms'&&Array.isArray(obj)){renderUniformsEditor(parent,obj,path);return}if(path.length===1&&path[0]==='sliders'){const presetFields=el('div','fields');parent.append(presetFields);field(presetFields,'gameStyle',league.settings?.gameStyle??0,['settings','gameStyle'])}if(path.length===1&&path[0]==='awards'){renderAwards(parent);return}if(path.length===1&&path[0]==='simulationSliders'){const presetFields=el('div','fields');parent.append(presetFields);field(presetFields,'simulationPreset',league.season?.simulationPreset??0,['season','simulationPreset'])}if(path.length===2&&path[0]==='meta'&&path[1]==='generatedCountries'&&Array.isArray(obj)){renderCountries(parent,path);return}if(path.length===1&&path[0]==='season'&&!seasonSubset){renderSeason(parent,obj);return}if(path.at(-1)==='teamColors'){renderTeamColors(parent,path);return}if(isUniformPath(path))renderUniformPreview(parent,path);const teamRoot=path.length===2&&['teams','starTeams'].includes(path[0]);const teamDetailKeys=['name','shortName','arenaName','logoURL','tag','division'];if(teamRoot){const section=el('details','team-details'),detailsFields=el('div','fields');section.append(el('summary','','Team Details'),detailsFields);parent.append(section);for(const key of teamDetailKeys)if(Object.hasOwn(obj,key))field(detailsFields,key,obj[key],[...path,key]);renderTeamLocation(parent,obj,path)}const fields=el('div','fields');parent.append(fields);for(const [k,v]of orderedFields(obj,path)){if(teamRoot&&teamDetailKeys.includes(k))continue;if(teamRoot&&k==='retiredNumbers'){renderTeamRetiredNumbers(parent,obj,[...path,k]);continue}if(path.length===0&&k==='conferences'){renderLeagueStructure(parent);continue}if(path.length===0&&k==='divisions')continue;if(path.length===0&&['gameballs','courts','tournamentCourts','settings','optimization','coachSettings'].includes(k))continue;if(path.length===1&&path[0]==='settings'&&['gameBall','referee','gameStyle'].includes(k))continue;if(path.length===1&&path[0]==='rules'&&['blockingFouls','partialShotClock'].includes(k))continue;if(path.length===1&&path[0]==='difficulty'&&['defensiveAssistance','offensiveAssistance'].includes(k))continue;if(path.at(-1)==='frontOffice'&&['coins','condition','morale','fans','adsURL','adSize','scoutAssignment'].includes(k))continue;if(path.at(-1)==='frontOffice'&&k==='facilities'){renderFacilities(parent,v,[...path,k]);continue}if(protectedKeys.has(k)||hiddenState.has(k)||(['teams','starTeams'].includes(k)&&path.length===0))continue;if((teamRoot&&['city','location','logoSize'].includes(k))||(path.length===0&&k==='logoSize'))continue;if(path[0]==='teams'||path[0]==='starTeams'){if(['id','isPlayer','season','coinFlip','status','rnk','following'].includes(k))continue}if(path.length===1&&path[0]==='meta'&&!['generatedCountries'].includes(k))continue;
 const p=[...path,k];if(path.length===1&&path[0]==='meta'&&k==='generatedCountries'){renderCountries(parent,p);continue}if(v!==null&&typeof v==='object'){const d=el('details'),summary=el('summary','',entryLabel(path,k,v)+(Array.isArray(v)&&k!=='awards'?` · ${v.length}`:''));d.append(summary);parent.append(d);d.addEventListener('toggle',()=>{if(d.open&&!d.dataset.built){d.dataset.built='1';if(Array.isArray(v)&&!v.length)d.append(el('p','','No entries in this league.'));else renderObject(d,v,p,depth+1)}},{once:false})}else field(fields,k,v,p);if(k==='court'&&path.length===2&&['teams','starTeams'].includes(path[0]))renderAnnouncerTable(parent,obj,path);if(path.length===0&&k==='simulationSliders'){renderFreeAgentsSection(parent);renderTournamentCourts(parent)}}
 if(!fields.children.length)fields.remove();if(teamRoot&&!Object.hasOwn(obj,'court'))renderAnnouncerTable(parent,obj,path);if(path.length===0){if(!Object.hasOwn(obj,'simulationSliders')){renderFreeAgentsSection(parent);renderTournamentCourts(parent)}renderRefereesSection(parent);renderLeagueRetiredNumbers(parent)};}
function renderRefereesSection(parent){
 const section=el('details','referees-editor'),summary=el('summary','','Referees'),host=el('div');section.append(summary,host);parent.append(section);
 const sync=()=>{summary.textContent=`Referees · ${(league.referees||[]).length} / 4`};sync();
 section.addEventListener('toggle',()=>{if(section.open&&!section.dataset.built){section.dataset.built='1';window.HLSRefereeEditor.render(host,{league,change:(path,value)=>{set(path,value);sync()}})}});
}
function renderAnnouncerTable(parent,team,path){
 renderCoachesSection(parent,team,path);
 const announcer=el('details','announcer-editor'),host=el('div');announcer.append(el('summary','','Announcer'),host);parent.append(announcer);
 announcer.addEventListener('toggle',()=>{if(announcer.open&&!announcer.dataset.built){announcer.dataset.built='1';window.HLSAnnouncerEditor.render(host,{team,path,change:set,addAnnouncer:async()=>{
  const response=await fetch('./data/team-generation-blueprints.json');if(!response.ok)throw Error('Could not load announcer defaults.');const defaults=await response.json();
  if(!host.isConnected||(team.frontOffice?.announcers||[]).length>=2)return;
  const person=window.HLSAnnouncerEditor.initialize(structuredClone(defaults.staff));Object.assign(person,{id:expansionPersonIdAllocator()(),tid:team.id,league:league.leagueType,pos:0,fn:'New',ln:'Announcer'});
  if(!team.frontOffice)set([...path,'frontOffice'],{});set([...path,'frontOffice','announcers'],[...(team.frontOffice.announcers||[]),person]);
 }})}});
 if(!team.frontOffice)return;const section=el('details');section.append(el('summary','','Announcer Table'));const fields=el('div','fields');section.append(fields);for(const key of ['adsURL','adSize'])if(Object.hasOwn(team.frontOffice,key))field(fields,key,team.frontOffice[key],[...path,'frontOffice',key]);parent.append(section)}
function renderCoachesSection(parent,team,path){
 const section=el('details','coach-editor'),host=el('div');section.append(el('summary','','Coaches'),host);parent.append(section);
 section.addEventListener('toggle',()=>{if(section.open&&!section.dataset.built){section.dataset.built='1';window.HLSCoachEditor.render(host,{team,path,league,change:set,addCoach:async role=>{
  const response=await fetch('./data/team-generation-blueprints.json');if(!response.ok)throw Error('Could not load coach defaults.');const defaults=await response.json();
  if(!host.isConnected)return;if((team.frontOffice?.staff||[]).some(person=>person.pos===role))return;
  const person=window.HLSAnnouncerEditor.initialize(structuredClone(defaults.staff));Object.assign(person,{id:expansionPersonIdAllocator()(),tid:team.id,league:league.leagueType,pos:role,status:1,fn:'New',ln:window.HLSCoachEditor.roles[role],age:40});
  person.contract.tid=team.id;person.contract.pid=person.id;
  if(role===1){Object.assign(person,{ht:72,wt:180,pot:5});person.attributes={development:[2,20],motivation:[2,14],leadership:[2,14]}}
  if(!team.frontOffice)set([...path,'frontOffice'],{});set([...path,'frontOffice','staff'],[...(team.frontOffice.staff||[]),person]);
 }})}});
}
const TEMPLATE_LOCATION_LABELS=new Map([
 ['-4288,14733','Hobart'],
 ['-4143,14714','Launceston'],
 ['-3756,14385','Ballarat'],
 ['-3676,14428','Bendigo'],
 ['-3195,11586','Perth'],
 ['-2747,15303','Brisbane'],
 ['-2114,14919','Mackay'],
 ['-1350,-17229','Manono'],
 ['-1246,13084','Darwin'],
 ['-909,-7858','Chimbote'],
 ['-602,10605','Cilegon'],
 ['1046,-6801','Puerto Cabello'],
 ['1200,859','Kano'],
 ['1494,-9111','Chichicastenango'],
 ['1971,-15508','Hilo'],
 ['2131,-15786','Honolulu'],
 ['2139,-15774','Kailua'],
 ['2141,-15797','Pearl City'],
 ['2485,8937','Bogura'],
 ['2576,-8019','Miami'],
 ['2846,-1625','Santa Cruz de Tenerife'],
 ['2854,-8138','Orlando'],
 ['2942,-9849','San Antonio'],
 ['2967,-8234','Gainesville'],
 ['2976,-9537','Houston'],
 ['2995,-9008','New Orleans'],
 ['3000,3255','Suez'],
 ['3021,-9321','Lake Charles'],
 ['3022,-9201','Lafayette'],
 ['3037,-8909','Gulfport'],
 ['3040,-8889','Biloxi'],
 ['3044,-8428','Tallahassee'],
 ['3045,-9115','Baton Rouge'],
 ['3062,-9634','College Station'],
 ['3069,-8804','Mobile'],
 ['3154,-9715','Waco'],
 ['3208,-8110','Savannah'],
 ['3230,-9018','Jackson'],
 ['3238,-8631','Montgomery'],
 ['3247,-8498','Columbus'],
 ['3252,-9377','Shreveport'],
 ['3272,-11716','San Diego'],
 ['3278,-9680','Dallas'],
 ['3278,-7993','Charleston'],
 ['3280,-7989','Mount Pleasant'],
 ['3284,-8363','Macon'],
 ['3288,-8002','North Charleston'],
 ['3331,-11184','Chandler'],
 ['3342,-11182','Mesa'],
 ['3345,-11207','Phoenix'],
 ['3347,-8197','Augusta'],
 ['3375,-8439','Atlanta'],
 ['3384,13277','Matsuyama'],
 ['3404,-8090','Columbia'],
 ['3405,-11824','Los Angeles'],
 ['3461,-9839','Lawton'],
 ['3474,-9227','Little Rock'],
 ['3493,-8103','Rock Hill'],
 ['3505,-8531','Chattanooga'],
 ['3508,-10665','Albuquerque'],
 ['3515,-9005','Memphis'],
 ['3523,-8084','Charlotte'],
 ['3539,-9441','Fort Smith'],
 ['3547,-9752','Oklahoma City'],
 ['3568,-10594','Santa Fe'],
 ['3578,-7864','Raleigh'],
 ['3585,1453','Ghaxaq'],
 ['3586,13965','Saitama'],
 ['3593,3663','Idlib'],
 ['3596,-8392','Knoxville'],
 ['3604,-11503','Henderson'],
 ['3605,-9579','Broken Arrow'],
 ['3606,-9416','Fayetteville'],
 ['3607,-7979','Greensboro'],
 ['3616,-8678','Nashville'],
 ['3619,-9413','Springdale'],
 ['3676,-7629','Chesapeake'],
 ['3685,-7629','Norfolk'],
 ['3685,-7598','Virginia Beach'],
 ['3769,-9734','Wichita'],
 ['3777,-12242','San Francisco'],
 ['3777,-8711','Owensboro'],
 ['3780,-12227','Oakland'],
 ['3797,-8756','Evansville'],
 ['3803,-7848','Charlottesville'],
 ['3835,-8164','Charleston'],
 ['3842,-8244','Huntington'],
 ['3858,-12149','Sacramento'],
 ['3888,-9482','Olathe'],
 ['3890,-7704','Washington'],
 ['3905,-9568','Topeka'],
 ['3907,-9441','Independence'],
 ['3909,-8451','Covington'],
 ['3910,-9458','Kansas City'],
 ['3921,-7686','Columbia'],
 ['3945,-7571','Middletown'],
 ['3953,-11975','Sparks'],
 ['3963,-7995','Morgantown'],
 ['3968,-7575','Newark'],
 ['3970,-10508','Lakewood'],
 ['3974,-10499','Denver'],
 ['3977,-8615','Indianapolis'],
 ['3995,-7516','Philadelphia'],
 ['3998,-8299','Columbus'],
 ['4001,-10530','Boulder'],
 ['4004,-7523','Villanova'],
 ['4007,-8072','Wheeling'],
 ['4008,2014','Gjirokaster'],
 ['4011,-7521','Flourtown'],
 ['4029,-11170','Orem'],
 ['4055,3496','Corum'],
 ['4057,-11186','Sandy'],
 ['4059,-10508','Fort Collins'],
 ['4060,-7547','Allentown'],
 ['4068,-7394','Brooklyn'],
 ['4069,-11200','West Valley City'],
 ['4070,-9908','Kearney'],
 ['4071,-7401','New York'],
 ['4071,-7387','Queens'],
 ['4073,-7407','Jersey City'],
 ['4076,-11189','Salt Lake City'],
 ['4092,-7416','Paterson'],
 ['4106,-7354','Stamford'],
 ['4108,-8514','Fort Wayne'],
 ['4114,-10482','Cheyenne'],
 ['4115,-9592','Bellevue'],
 ['4117,-7319','Bridgeport'],
 ['4126,-9601','Omaha'],
 ['4129,3633','Samsun'],
 ['4131,-10559','Laramie'],
 ['4131,-7292','New Haven'],
 ['4150,-8169','Cleveland'],
 ['4159,-9362','Des Moines'],
 ['4168,-8625','South Bend'],
 ['4174,-11184','Logan'],
 ['4175,-8815','Naperville'],
 ['4176,-8820','Aurora'],
 ['4176,-7268','Hartford'],
 ['4178,-7147','Cranston'],
 ['4181,-7135','East Providence'],
 ['4182,-7142','Providence'],
 ['4187,-8762','Chicago'],
 ['4198,-9166','Cedar Rapids'],
 ['4207,1951','Shkoder'],
 ['4212,-8009','Erie'],
 ['4223,-872','Vigo'],
 ['4226,-7180','Worcester'],
 ['4227,-8910','Rockford'],
 ['4228,-8374','Ann Arbor'],
 ['4231,-8304','Windsor'],
 ['4233,-8305','Detroit'],
 ['4236,-7106','Boston'],
 ['4237,-7110','Cambridge'],
 ['4250,-9640','Sioux City'],
 ['4258,-8303','Sterling Heights'],
 ['4264,-7132','Lowell'],
 ['4273,-8778','Racine'],
 ['4276,-7147','Nashua'],
 ['4286,-10631','Casper'],
 ['4296,-8567','Grand Rapids'],
 ['4298,-8125','London'],
 ['4299,-7146','Manchester'],
 ['4304,-8791','Milwaukee'],
 ['4305,-7615','Syracuse'],
 ['4314,2052','Novi Pazar'],
 ['4321,-7154','Concord'],
 ['4330,-7098','Rochester'],
 ['4345,-8049','Kitchener'],
 ['4349,-11204','Idaho Falls'],
 ['4355,-9673','Sioux Falls'],
 ['4361,-11639','Meridian'],
 ['4361,-7297','Rutland'],
 ['4370,-7942','Toronto'],
 ['4371,726','Nice'],
 ['4390,-7887','Oshawa'],
 ['4406,-12311','Eugene'],
 ['4408,-10323','Rapid City'],
 ['4410,-7021','Lewiston'],
 ['4419,-7250','Barre'],
 ['4420,1791','Zenica'],
 ['4426,-7257','Montpelier'],
 ['4429,-10550','Gillette'],
 ['4431,-9679','Brookings'],
 ['4452,-8802','Green Bay'],
 ['4465,-6358','Halifax'],
 ['4482,-9331','Bloomington'],
 ['4494,-12304','Salem'],
 ['4495,-9310','Saint Paul'],
 ['4497,-9326','Minneapolis'],
 ['4540,-7190','Sherbrooke'],
 ['4547,-9848','Aberdeen'],
 ['4550,-7357','Montreal'],
 ['4552,-12299','Hillsboro'],
 ['4552,-12268','Portland'],
 ['4563,-12265','Vancouver'],
 ['4599,-11253','Butte'],
 ['4616,1505','Trbovlje'],
 ['4617,1431','Skofja Loka'],
 ['4642,1587','Ptuj'],
 ['4643,1406','Jesenice'],
 ['4681,-10078','Bismarck'],
 ['4681,-7121','Quebec City'],
 ['4688,-9679','Fargo'],
 ['4725,-12244','Tacoma'],
 ['4756,-5271','St. John\'s'],
 ['4761,-12233','Seattle'],
 ['4766,-11743','Spokane'],
 ['4792,-9707','Grand Forks'],
 ['4812,-168','Rennes'],
 ['4823,-10130','Minot'],
 ['4843,-12337','Victoria'],
 ['4926,403','Reims'],
 ['4928,-12312','Vancouver'],
 ['4989,-9714','Winnipeg'],
 ['4990,-9714','Winnipeg'],
 ['5045,-10462','Regina'],
 ['5105,1374','Dresden'],
 ['5214,-10665','Saskatoon'],
 ['5264,-114','Leicester'],
 ['5354,-11349','Edmonton'],
 ['5355,-11349','Edmonton'],
 ['5705,-13533','Sitka'],
 ['6122,-14989','Anchorage'],
]);
function inferredTeamLocation(team){
 const explicit=String(team?.city??'').trim();if(explicit)return explicit;
 return geographicTeamCity(team);
}
function geographicTeamCity(team){
 const x=Number(team?.location?.x),y=Number(team?.location?.y);
 if(!Number.isFinite(x)||!Number.isFinite(y))return '';
 const supported=supportedLocationByCoordinates(x,y);if(supported)return supported.city;
 const known=TEMPLATE_LOCATION_LABELS.get(Math.round(x)+','+Math.round(y));if(known)return known;
 return '';
}
function teamDisplayName(team){
 return [inferredTeamLocation(team),team?.name].filter(Boolean).join(' ')||team?.shortName||'Unnamed team';
}
function renderTeamSelection(parent){
 const card=el('section','card team-selection-card');
 card.append(el('h2','','Choose a Team'));

 const divisions=league.divisions||[],conferences=league.conferences||[];
 const perConference=conferences.length&&divisions.length%conferences.length===0?divisions.length/conferences.length:0;

 function openTeam(t,i,type){
  const full=teamDisplayName(t);
  const b=el('button','team-selection-button');
  const icon=window.HLSTeamLogo.create(t);
  b.type='button';
  b.setAttribute('aria-label','Open '+(full||'Unnamed team'));
  b.title=full||'Unnamed team';
  b.append(icon);
  b.onclick=()=>{if(!canNavigate())return;selected=i;teamList=type;view='team';render()};
  return b;
 }

 function appendGrid(entries,type){
  const grid=el('div','team-selection-grid');
  for(const {t,i} of entries)grid.append(openTeam(t,i,type));
  card.append(grid);
 }

 const entries=(league.teams||[]).map((t,i)=>({t,i}));
 let lastConference=-1;
 let any=false;

 for(let d=0;d<divisions.length;d++){
  const members=entries.filter(({t})=>t.division===d);
  if(!members.length)continue;
  const conference=league.leagueType===1?d:perConference?Math.floor(d/perConference):-1;

  if(conference!==lastConference){
   const name=(league.leagueType===1?divisions[conference]:conferences[conference])||'Conference '+(conference+1);
   card.append(el('h3','team-selection-conference',name));
   lastConference=conference;
  }
  if(league.leagueType!==1){
   card.append(el('h4','team-selection-division',divisions[d]||'Division '+(d+1)));
  }
  appendGrid(members,'teams');
  any=true;
 }

 const unassigned=entries.filter(({t})=>!Number.isInteger(t.division)||t.division<0||t.division>=divisions.length);
 if(unassigned.length){
  card.append(el('h3','team-selection-conference',divisions.length?'Unassigned Teams':'Teams'));
  appendGrid(unassigned,'teams');
  any=true;
 }

 const stars=(league.starTeams||[]).map((t,i)=>({t,i}));
 if(stars.length){
  card.append(el('h3','team-selection-conference','All-Star Teams'));
  appendGrid(stars,'starTeams');
  any=true;
 }

 if(!any)card.append(el('p','team-selection-empty','No teams are available in this league.'));
 parent.append(card);
}
function listTeams(){
 const box=$('#teams');box.replaceChildren();const q=$('#teamSearch').value.trim().toLowerCase();
 const divisions=league.divisions||[],conferences=league.conferences||[];
 const perConference=conferences.length&&divisions.length%conferences.length===0?divisions.length/conferences.length:0;
 function matches(t){return [inferredTeamLocation(t),t.name,t.shortName].filter(Boolean).join(' ').toLowerCase().includes(q)}
 function button(t,i,type){
  const full=teamDisplayName(t);
  const b=el('button','team'+(view==='team'&&selected===i&&teamList===type?' active':''));
  const icon=window.HLSTeamLogo.create(t),txt=el('span','team-label',full||'Unnamed team');txt.append(window.HLSRatings.create(()=>window.HLSRatings.team(t),'Team rating'));
  b.append(icon,txt);b.onclick=()=>{if(!canNavigate())return;selected=i;teamList=type;view='team';render()};box.append(b);
 }
 const entries=(league.teams||[]).map((t,i)=>({t,i})).filter(({t})=>matches(t));
 let lastConference=-1;
 for(let d=0;d<divisions.length;d++){
  const members=entries.filter(({t})=>t.division===d);if(!members.length)continue;
  const conference=league.leagueType===1?d:perConference?Math.floor(d/perConference):-1;
  if(conference!==lastConference){box.append(el('h3','team-conference',(league.leagueType===1?divisions[conference]:conferences[conference])||'Conference '+(conference+1)));lastConference=conference}
  if(league.leagueType!==1)box.append(el('h4','team-division',divisions[d]||'Division '+(d+1)));
  for(const {t,i}of members)button(t,i,'teams');
 }
 const unassigned=entries.filter(({t})=>!Number.isInteger(t.division)||t.division<0||t.division>=divisions.length);
 if(unassigned.length){box.append(el('h3','team-conference',divisions.length?'Unassigned teams':'Teams'));for(const {t,i}of unassigned)button(t,i,'teams')}
 const stars=(league.starTeams||[]).map((t,i)=>({t,i})).filter(({t})=>matches(t));
 if(stars.length){box.append(el('h3','team-conference','All-Star teams'));for(const {t,i}of stars)button(t,i,'starTeams')}
 if(!entries.length&&!stars.length)box.append(el('p','team-empty','No teams match your search.'));
 $('#teamCount').textContent=league.teams.length;
}
function canNavigate(){if($('.invalid')){toast('Fix the highlighted number before continuing.');return false}return true}
const teamSelectionViewport=window.matchMedia('(max-width:760px)');
teamSelectionViewport.addEventListener('change',()=>{
 if(!teamSelectionViewport.matches&&view==='teamSelect'){view='league';render()}
 else renderPageNav();
});
function renderPageNav(){
 const nav=$('#pageNav');
 if(!nav)return;
 nav.replaceChildren();
 nav.classList.remove('single');
 nav.classList.toggle('team-actions',view==='team'||view==='roster');
 nav.hidden=true;

 function add(label,target,before){
  const b=el('button','',label);
  b.type='button';
  b.onclick=()=>{
   if(!canNavigate())return;
   if(before)before();
   view=target;
   render();
  };
  nav.append(b);
 }

 if(view==='images'){
  add(league?'League Configuration →':'← Home',league?'league':'home');
 }else if(view==='league'&&league){
  add('← Image Archive','images');
  if(teamSelectionViewport.matches)add('Team Configuration →','teamSelect');
 }else if(view==='teamSelect'&&league){
  add('← League Configuration','league');
 }else if(view==='team'&&league){
  if(teamSelectionViewport.matches)add('← Team Selection','teamSelect');
  else add('← League Configuration','league');
  if(teamList==='teams')add('Manage Roster','roster');
 }else if(view==='roster'&&league){
  add('← Team Configuration','team');
  if(teamSelectionViewport.matches)add('Team Selection','teamSelect');
 }

 if(nav.children.length){
  nav.classList.toggle('single',nav.children.length===1);
  nav.hidden=false;
 }
}
function renderWelcome(){
 renderPageNav();
 $('#status').hidden=false;document.body.classList.toggle('workspace-home',view==='home');
 $('#teams').replaceChildren();$('#teamCount').textContent='0';$('#teamSearch').disabled=true;$('#saveProgress').disabled=!league;$('#export').disabled=!league;
 const teamPanel=$('#leagueTeamPanel');if(teamPanel)teamPanel.hidden=true;
 $('#gettingStartedNav').classList.toggle('active',view==='home');$('#leagueNav').classList.toggle('active',view==='league'||view==='teamSelect'||view==='team');$('#imagesNav').classList.toggle('active',view==='images');
 const content=$('#content');content.replaceChildren();
 if(view==='images'){document.body.classList.remove('workspace-home');renderArchive();return}
 $('#title').textContent='Getting Started';$('#breadcrumb').textContent='HOOP LEAGUE STUDIO';$('#subtitle').textContent='Create and customize Hoop Land leagues.';$('#status').textContent=league?'League ready':'Choose how to begin';
 const shell=el('div','getting-started-shell');
 const hero=el('section','heading getting-started-hero');
 const heroText=el('div');
 heroText.append(el('p','eyebrow','Getting Started'),el('h1','','Hoop League Studio'),el('p','','A comprehensive league editor for Hoop Land'));
 hero.append(heroText);
 shell.append(hero);
 const grid=el('div','starter-grid getting-started-workspaces');

 const card=el('section','card starter-card');
 card.append(el('p','eyebrow','LEAGUE STUDIO'),el('h2','','League Studio'),el('p','','Start a league or continue working on one you already have.'));
 const actions=el('div','starter-actions'),create=el('button','primary','New League'),upload=el('button','','Import League'),restore=el('button','','Load League');
 create.type=upload.type=restore.type='button';
 create.onclick=()=>$('#new').click();upload.onclick=()=>$('#import').click();restore.onclick=()=>$('#restoreProgress').click();
 actions.append(create,upload,restore);card.append(actions);grid.append(card);

 const archiveCard=el('section','card starter-card');
 archiveCard.append(el('p','eyebrow','IMAGES'),el('h2','','Image Archive'),el('p','','Keep league logos, courts, and ads organized and ready to use.'));
 const archiveActions=el('div','starter-actions starter-actions-single'),openArchive=el('button','','Open Image Archive');
 openArchive.type='button';openArchive.onclick=()=>{view='images';render()};
 archiveActions.append(openArchive);archiveCard.append(archiveActions);grid.prepend(archiveCard);
 shell.append(grid);content.append(shell);
}
function renderLeagueStudioEmpty(){
 renderPageNav();
 document.body.classList.remove('workspace-home');
 $('#status').hidden=false;$('#status').textContent='No league loaded';
 $('#teams').replaceChildren();$('#teamCount').textContent='0';$('#teamSearch').disabled=true;$('#saveProgress').disabled=true;$('#export').disabled=true;
 const teamPanel=$('#leagueTeamPanel');if(teamPanel)teamPanel.hidden=true;
 $('#gettingStartedNav').classList.remove('active');$('#imagesNav').classList.remove('active');$('#leagueNav').classList.add('active');
 $('#title').textContent='League Studio';$('#breadcrumb').textContent='LEAGUE / STUDIO';$('#subtitle').textContent='Create, import, or load a league to begin editing.';
 const content=$('#content');content.replaceChildren();
 const card=el('section','card starter-card league-studio-empty');
 card.append(el('p','eyebrow','LEAGUE STUDIO'),el('h2','','No League Loaded'),el('p','','Start a league or continue working on one you already have.'));
 const actions=el('div','starter-actions'),create=el('button','primary','New League'),upload=el('button','','Import League'),loadLeague=el('button','','Load League');
 create.type=upload.type=loadLeague.type='button';
 create.onclick=()=>$('#new').click();upload.onclick=()=>$('#import').click();loadLeague.onclick=()=>$('#restoreProgress').click();
 actions.append(create,upload,loadLeague);card.append(actions);content.append(card);
}
function moveRosterPlayer(sourceIndex,targetIndex,playerId){
 const source=league.teams[sourceIndex],target=league.teams[targetIndex];if(!source||!target||source===target)return;
 const roster=Array.isArray(source.roster)?source.roster:[],player=roster.find(item=>Number(item.id)===Number(playerId));if(!player)return;
 const moved={...player,tid:target.id};
 if(player.contract&&Number(player.contract.tid)===Number(source.id))moved.contract={...player.contract,tid:target.id};
 set(['teams',sourceIndex,'roster'],roster.filter(item=>item!==player));
 set(['teams',targetIndex,'roster'],[...(target.roster||[]),moved]);
 if(Array.isArray(source.startingLineup)&&source.startingLineup.some(item=>Number(item?.id??item)===Number(playerId)))set(['teams',sourceIndex,'startingLineup'],source.startingLineup.filter(item=>Number(item?.id??item)!==Number(playerId)));
 selected=targetIndex;teamList='teams';window.HLSRosterManager.focusId=playerId;render();
}
function releaseRosterPlayer(teamIndex,player){
 const team=league.teams[teamIndex],id=Number(player.id),name=[player.fn,player.ln].filter(Boolean).join(' ')||'Player '+id;
 if(!team?.roster?.includes(player))return false;
 if(player.isPlayer||Number(league.season?.playerId)===id){toast('The controlled career player cannot be released.');return false}
 const role=league.leagueType===1?'Prospect':'Free Agent';
 if(!confirm('Release '+name+' from '+teamDisplayName(team)+'? This player will become a '+role+'.'))return false;
 const matches=item=>Number(item?.pid??item?.id??item)===id;
 set(['teams',teamIndex,'roster'],team.roster.filter(item=>!matches(item)));
 for(const key of ['startingLineup','scoringOptions'])if(Array.isArray(team[key]))set(['teams',teamIndex,key],team[key].filter(item=>!matches(item)));
 const released={...player,tid:0};
 if(player.contract)released.contract={...player.contract,tid:0};
 set(['freeAgents'],[...(league.freeAgents||[]).filter(item=>!matches(item)),released]);
 window.HLSRatings?.rebuildLineups(league,false);
 window.HLSRosterManager.focusId=null;toast(name+' is now a '+role+'.');return true;
}
function removeLeaguePlayer(player){
 const id=Number(player.id),name=[player.fn,player.ln].filter(Boolean).join(' ')||'Player '+id;
 if(player.isPlayer||Number(league.season?.playerId)===id){toast('The controlled career player cannot be removed.');return false}
 if(!confirm('Delete '+name+' from this league? This cannot be undone.'))return false;
 const matches=item=>Number(item?.pid??item?.id??item)===id;
 for(const collection of ['teams','starTeams'])for(const [index,team]of (league[collection]||[]).entries()){
  for(const key of ['roster','startingLineup','scoringOptions'])if(Array.isArray(team[key])&&team[key].some(matches))set([collection,index,key],team[key].filter(item=>!matches(item)));
 }
 for(const key of ['freeAgents','draftClass'])if(Array.isArray(league[key])&&league[key].some(matches))set([key],league[key].filter(item=>!matches(item)));
 window.HLSRatings?.rebuildLineups(league,false);
 window.HLSRosterManager.focusId=null;toast(name+' removed from the league.');return true;
}
function renderFreeAgentsSection(parent){
 const section=el('details','free-agents-editor'),summary=el('summary','',league.leagueType===1?'Prospects':'Free Agents'),host=el('div','free-agents-roster');
 section.append(summary,host);parent.append(section);let draft=null;
 const refresh=()=>{
  summary.textContent=`${league.leagueType===1?'Prospects':'Free Agents'} · ${(league.freeAgents||[]).length}`;host.replaceChildren();
  window.HLSRosterManager.render(host,{league,freeAgents:true,draftPlayer:draft,
   onRemovePlayer:player=>{if(removeLeaguePlayer(player))refresh()},
   change:(path,value)=>{if(path[0]!=='draft'){set(path,value);return}let target=draft;for(const key of path.slice(1,-1))target=target[key];target[path.at(-1)]=value},
   move:(targetIndex,playerId)=>{const target=league.teams[targetIndex],agents=league.freeAgents||[],player=agents.find(item=>Number(item.id)===Number(playerId));if(!target||!player)return;
    set(['freeAgents'],agents.filter(item=>item!==player));set(['teams',targetIndex,'roster'],[...(target.roster||[]),{...player,tid:target.id}]);window.HLSRosterManager.focusId=null;refresh()},
   onAddPlayer:async()=>{if(!draft){try{const response=await fetch('./data/player-blueprint.json');if(!response.ok)throw Error('Player template could not be loaded.');draft=await response.json();draft.league=league.leagueType}catch(error){toast(error.message||'Could not load player editor.');return}}refresh();host.querySelector('input[aria-label="First name"]')?.focus()},
   onCreatePlayer:player=>{const invalid=[...host.querySelectorAll('.roster-player-panel input')].find(input=>!input.checkValidity());if(invalid){invalid.reportValidity();return}const first=player.fn.trim(),last=player.ln.trim();if(!first||!last){toast('Enter a first and last name.');host.querySelector(!first?'input[aria-label="First name"]':'input[aria-label="Last name"]')?.focus();return}
    player.fn=first;player.ln=last;player.id=expansionPersonIdAllocator(league)();player.tid=0;player.teamPos=player.pos;
    set(['freeAgents'],[...(league.freeAgents||[]),player]);window.HLSRosterManager.focusId=player.id;draft=null;refresh()},
   onCancelPlayer:()=>{draft=null;refresh()}
  });
 };
 refresh();
}
let renderedPage=null,renderedLeague=null;
function render(){
 const archiveStatus=$('#archiveStatus');if(archiveStatus)archiveStatus.hidden=true;
 if(view==='teamSelect'&&!teamSelectionViewport.matches)view='league';
 const pageKey=view+((view==='team'||view==='roster')?`/${teamList}/${selected}`:'');
 if(pageKey!==renderedPage||league!==renderedLeague){
  renderedPage=pageKey;renderedLeague=league;
  requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:'instant'}));
 }
 if(view!=='images')$('#status').hidden=false;
 if(view==='home'){renderWelcome();return}
 if(view==='league'&&!league){renderLeagueStudioEmpty();return}
 document.body.classList.remove('workspace-home');
 const teamPanel=$('#leagueTeamPanel');if(teamPanel)teamPanel.hidden=view==='images';
 $('#teamSearch').disabled=!league;$('#saveProgress').disabled=!league;$('#export').disabled=!league;
 if(league&&view!=='images')listTeams();
 $('#gettingStartedNav').classList.toggle('active',view==='home');
 $('#leagueNav').classList.toggle('active',view==='league'||view==='teamSelect'||view==='team'||view==='roster');
 $('#imagesNav').classList.toggle('active',view==='images');
 const content=$('#content');content.replaceChildren();
 if(view==='images'){renderArchive();return}
 if(!league){view='home';renderWelcome();return}
 renderPageNav();
 if(view==='teamSelect'){
  $('#title').textContent='Team Configuration';
  $('#breadcrumb').textContent='TEAMS / SELECT';
  $('#subtitle').textContent=`Choose a team to configure · ${league.teams.length} teams`;
  renderTeamSelection(content);
  return;
 }
 const t=league[teamList]?.[selected];
 if(!t&&(view==='team'||view==='roster')){view='teamSelect';render();return}
 if(view==='roster'){
  $('#title').textContent='Manage Roster';$('#breadcrumb').textContent='TEAMS / ROSTER';$('#subtitle').textContent=teamDisplayName(t);
  window.HLSRosterManager.render(content,{league,teamIndex:selected,change:set,move:moveRosterPlayer,onRemovePlayer:player=>{if(releaseRosterPlayer(selected,player))render()}});return;
 }
 $('#title').textContent=view==='league'?league.leagueName:teamDisplayName(t);
 $('#breadcrumb').textContent=view==='league'?'LEAGUE / SETTINGS':'TEAMS / '+(t.shortName||'DETAILS');
 $('#subtitle').textContent=view==='league'?(league.leagueType===1?`${league.teams.length} teams · ${league.divisions.length} conferences`:`${league.teams.length} teams · ${league.conferences.length} conferences · ${league.divisions.length} divisions`):'Identity, uniforms, court and team settings';
 const shell=el('div','configuration-shell'),card=el('section','card configuration-card');
 card.append(el('h2','',view==='league'?'League configuration':'Team configuration'));
 if(view==='team'){
  const logo=el('div','team-config-logo'),icon=window.HLSTeamLogo.create(t);
  icon.classList.add('team-icon-large');logo.append(icon,el('span','team-config-name',teamDisplayName(t)),window.HLSRatings.createTeamSummary(t,()=>league.teams||[]));card.append(logo);
 }
 content.append(shell);
 shell.append(card);
 renderObject(card,view==='league'?league:t,view==='league'?[]:[teamList,selected]);
}
let localAssets=[],archiveSources=[],openSourceEditor=false,archiveSourceTab='online';
function sourceKey(source){return source.repository.toLowerCase()+'@'+source.branch}
function syncArchiveList(){assets.sort((a,b)=>a.name.localeCompare(b.name));$('#assetCount').textContent=assets.length}
function renderConnectedSources(parent){
 const card=el('section','card archive-connected-sources');card.append(el('h2','','Connected Sources'));parent.append(card);
 const localIds=[...new Set(localAssets.map(a=>a.sourceId||'local'))];
 if(!archiveSources.length&&!localIds.length){card.append(el('p','archive-empty-source','No sources connected yet.'));return}

 if(archiveSources.length){
  const group=el('div','archive-connected-group');group.append(el('h3','','GitHub / Online'));card.append(group);
  for(const source of archiveSources){
   const row=el('div','archive-source-row'),info=el('div'),remove=el('button','','Remove');
   info.append(el('strong','',source.repository),el('small','',source.branch));
   remove.type='button';remove.onclick=()=>{if(archiveRefreshing)return;archiveSources=archiveSources.filter(s=>sourceKey(s)!==sourceKey(source));assets=assets.filter(a=>a.sourceId!==sourceKey(source));syncArchiveList();dirty=true;render()};
   row.append(info,remove);group.append(row);
  }
 }

 if(localIds.length){
  const group=el('div','archive-connected-group');group.append(el('h3','','Local Sources'));card.append(group);
  for(const id of localIds){
   const row=el('div','archive-source-row'),info=el('div'),remove=el('button','','Remove');
   const sourceName=localAssets.find(a=>(a.sourceId||'local')===id)?.sourceName||'Local images';
   const count=localAssets.filter(a=>(a.sourceId||'local')===id).length;
   info.append(el('strong','',sourceName),el('small','',count+' '+(count===1?'image':'images')));
   remove.type='button';remove.onclick=()=>{localAssets=localAssets.filter(a=>(a.sourceId||'local')!==id);assets=assets.filter(a=>!a.isLocal||(a.sourceId||'local')!==id);syncArchiveList();dirty=true;render()};
   row.append(info,remove);group.append(row);
  }
 }
}

function leagueAssetPath(path){const parts=path.split('/');const i=parts.findIndex((p,i)=>i>0&&['logos','courts','ads'].includes(p.toLowerCase()));if(i<1||! /\.(png|jpg|jpeg|webp)$/i.test(parts.at(-1)))return null;return {leagueName:parts[i-1],kind:{logos:'Logos',courts:'Courts',ads:'Ads'}[parts[i].toLowerCase()]}}
function downloadLeagueFolders(name){
 if(!name.trim()||/[<>:"/\\|?*]/.test(name)||name==='.'||name==='..'){toast('Enter a valid league folder name.');return}
 const enc=new TextEncoder(),files=['README.txt','Logos/README.txt','Courts/README.txt','Ads/README.txt'].map(p=>({name:enc.encode(name.trim()+'/'+p),data:enc.encode('Place your league images in Logos, Courts, or Ads. Import the parent folder into Hoop League Studio, or upload it to GitHub. Each league is named by its folder.\n')}));
 const chunks=[],central=[];let offset=0,total=0;
 function header(size){const bytes=new Uint8Array(size);return {bytes,v:new DataView(bytes.buffer)}}
 for(const file of files){let crc=0xffffffff;for(const byte of file.data){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}crc=(crc^0xffffffff)>>>0;const l=header(30);l.v.setUint32(0,0x04034b50,true);l.v.setUint16(4,20,true);l.v.setUint16(6,0x800,true);l.v.setUint32(14,crc,true);l.v.setUint32(18,file.data.length,true);l.v.setUint32(22,file.data.length,true);l.v.setUint16(26,file.name.length,true);chunks.push(l.bytes,file.name,file.data);
 const c=header(46);c.v.setUint32(0,0x02014b50,true);c.v.setUint16(4,20,true);c.v.setUint16(6,20,true);c.v.setUint16(8,0x800,true);c.v.setUint32(16,crc,true);c.v.setUint32(20,file.data.length,true);c.v.setUint32(24,file.data.length,true);c.v.setUint16(28,file.name.length,true);c.v.setUint32(42,offset,true);central.push(c.bytes,file.name);total+=46+file.name.length;offset+=30+file.name.length+file.data.length}
 const end=header(22);end.v.setUint32(0,0x06054b50,true);end.v.setUint16(8,files.length,true);end.v.setUint16(10,files.length,true);end.v.setUint32(12,total,true);end.v.setUint32(16,offset,true);const url=URL.createObjectURL(new Blob([...chunks,...central,end.bytes],{type:'application/zip'}));const a=el('a');a.href=url;a.download=name.trim()+' Assets.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function localAssetImporter(parent){
 const files=el('input');files.type='file';files.multiple=true;files.webkitdirectory=true;
 const label=el('label','field archive-folder-picker');label.append(el('span','','Choose Folder'),files);parent.append(label);
 files.onchange=async()=>{
  const added=[],sourceId='local:'+Date.now(),sourceName=files.files[0]?.webkitRelativePath.split('/')[0]||'Local folder';
  try{
   for(const file of files.files){
    const path=file.webkitRelativePath,meta=leagueAssetPath(path);if(!meta)continue;
    const local=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)});
    const size=await imageDimensions(local);
    added.push({sourceId,sourceName,path,name:file.name,collection:meta.leagueName,group:meta.leagueName,era:meta.leagueName,kind:meta.kind,url:local,local,width:size.width,height:size.height,aliases:[],isLocal:true});
   }
   if(!added.length){toast('No images found in Logos, Courts, or Ads.');return}
   localAssets.push(...added);assets.push(...added);syncArchiveList();archiveSourceTab='local';dirty=true;render();toast('Local images imported. Save League to keep them.');
  }catch(e){toast('Could not import folder: '+e.message)}
 };
}

let archiveSource={repository:'',branch:'main',folders:[]};

function archiveStepCard(number,title,body){
 const card=el('section','card archive-step-card');
 card.append(el('p','eyebrow archive-step-label','STEP '+number),el('h2','',title));
 if(body)card.append(el('p','',body));
 return card;
}
function archiveSetupSteps(parent){
 const step1=archiveStepCard(1,'Download Folder Template','Enter your league name and download the required folder template.');
 const templateRow=el('div','archive-template-row'),name=el('input'),download=el('button','primary','Download Folder Template');
 name.placeholder='League name';name.setAttribute('aria-label','League name for folder template');
 download.type='button';download.onclick=()=>downloadLeagueFolders(name.value);
 templateRow.append(name,download);step1.append(templateRow);parent.append(step1);

 const step2=archiveStepCard(2,'Extract','Extract the downloaded ZIP before adding images.');
 const directions=el('div','archive-extract-directions');
 directions.append(el('span','','Windows: Right-click the ZIP → Extract All.'),el('span','','macOS: Double-click the ZIP.'));
 step2.append(directions);parent.append(step2);

 const step3=archiveStepCard(3,'Place Your League Assets','Put each image in the matching folder. Keep the folder names unchanged.');
 const folders=el('div','archive-folder-grid');
 for(const [name,desc]of [['Logos','Team and league logos'],['Courts','Court and floor images'],['Ads','Arena advertisement images']]){
  const item=el('div','archive-folder-item');item.append(el('strong','',name),el('small','',desc));folders.append(item);
 }
 step3.append(folders);parent.append(step3);
}

function normalizeGitHubRepository(value){
 return String(value||'').trim()
  .replace(/^https?:\/\/github\.com\//i,'')
  .replace(/^github\.com\//i,'')
  .replace(/\.git$/i,'')
  .replace(/\/+$/,'')
  .split('/').slice(0,2).join('/');
}
const GITHUB_BRANCH_CACHE_PREFIX='hlls-github-branches-v2:',GITHUB_TREE_CACHE_PREFIX='hlls-github-tree-v2:';
const GITHUB_BRANCH_CACHE_TTL=24*60*60*1000,GITHUB_TREE_CACHE_TTL=60*60*1000;
function readGitHubCache(key,ttl,allowExpired=false){
 try{
  const item=JSON.parse(localStorage.getItem(key)||'null');
  if(!item||!item.savedAt||item.data==null)return null;
  const age=Date.now()-Number(item.savedAt);
  if(!allowExpired&&age>ttl)return null;
  return {data:item.data,stale:age>ttl,savedAt:Number(item.savedAt)};
 }catch{return null}
}
function writeGitHubCache(key,data){
 try{localStorage.setItem(key,JSON.stringify({savedAt:Date.now(),data}))}catch{}
}
function githubRateLimitMessage(response){
 const retry=Number(response.headers.get('retry-after')||0);
 const remaining=response.headers.get('x-ratelimit-remaining');
 const reset=Number(response.headers.get('x-ratelimit-reset')||0)*1000;
 if(retry>0)return 'GitHub is temporarily rate limiting requests. Try again in about '+Math.max(1,Math.ceil(retry/60))+' minute'+(retry>60?'s':'')+'.';
 if(remaining==='0'&&reset>Date.now())return 'GitHub request limit reached. Try again after '+new Date(reset).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})+'.';
 return 'GitHub request limit reached. Try again later.';
}
function isValidGitHubRepositoryInput(value){
 const raw=String(value||'').trim();
 return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?\/?$/.test(raw)
  || /^https?:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?\/?$/i.test(raw)
  || /^github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?\/?$/i.test(raw);
}
async function fetchGitHubJSON(url,timeout=10000){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
 try{
  const response=await fetch(url,{
   cache:'no-store',
   headers:{Accept:'application/vnd.github+json'},
   signal:controller.signal
  });
  if(response.status===403||response.status===429)throw Error(githubRateLimitMessage(response));
  if(response.status===404)throw Error('Repository not found or private. Image Archive requires a public repository.');
  if(!response.ok)throw Error('GitHub returned '+response.status+'.');
  return await response.json();
 }catch(error){
  if(error?.name==='AbortError')throw Error('GitHub took too long to respond. Try again.');
  throw error;
 }finally{
  clearTimeout(timer);
 }
}
async function fetchPublicGitHubBranches(repository,force=false){
 const repo=normalizeGitHubRepository(repository);
 if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo))throw Error('Enter owner/repository or a GitHub URL.');
 const key=GITHUB_BRANCH_CACHE_PREFIX+repo.toLowerCase(),cached=readGitHubCache(key,GITHUB_BRANCH_CACHE_TTL);
 if(cached&&!force)return {...cached.data,fromCache:true};

 try{
  const rows=await fetchGitHubJSON('https://api.github.com/repos/'+repo+'/branches?per_page=100');
  const branches=Array.isArray(rows)?[...new Set(rows.map(row=>row?.name).filter(Boolean))]:[];
  if(!branches.length)throw Error('No branches found in this repository.');
  const defaultBranch=branches.includes('main')?'main':branches.includes('master')?'master':branches[0];
  const result={repository:repo,defaultBranch,branches};
  writeGitHubCache(key,result);
  return result;
 }catch(error){
  const stale=readGitHubCache(key,GITHUB_BRANCH_CACHE_TTL,true);
  if(stale)return {...stale.data,fromCache:true,warning:'Using the last saved branch list. '+error.message};
  if(/rate limit/i.test(error.message)){
   return {repository:repo,defaultBranch:'main',branches:['main','master'],fallback:true,warning:error.message+' You can still try main or master.'};
  }
  throw error;
 }
}
function githubTreeCacheKey(source){return GITHUB_TREE_CACHE_PREFIX+sourceKey(source)}
async function loadArchiveSource(source,force=false){
 const key=githubTreeCacheKey(source),cached=readGitHubCache(key,GITHUB_TREE_CACHE_TTL);

 // Older cache entries did not contain commitSha. Refresh those automatically.
 if(cached&&!force&&Array.isArray(cached.data)&&cached.data.length&&cached.data.every(asset=>/^[a-f0-9]{40}$/i.test(asset.commitSha||''))){
  return {assets:cached.data,fromCache:true};
 }

 try{
  const branchURL='https://api.github.com/repos/'+source.repository+'/branches/'+encodeURIComponent(source.branch);
  const treeURL='https://api.github.com/repos/'+source.repository+'/git/trees/'+encodeURIComponent(source.branch)+'?recursive=1';
  const [branch,data]=await Promise.all([
   fetchGitHubJSON(branchURL,15000),
   fetchGitHubJSON(treeURL,15000)
  ]);

  const commitSha=String(branch?.commit?.sha||'').trim();
  if(!/^[a-f0-9]{40}$/i.test(commitSha))throw Error('Could not resolve the current GitHub commit.');
  if(data.truncated||!Array.isArray(data.tree))throw Error('Incomplete repository response.');

  const entries=data.tree.filter(entry=>entry.type==='blob'&&leagueAssetPath(entry.path));
  if(!entries.length)throw Error('No images in League Name/Logos, Courts, or Ads.');

  const loaded=entries.map(entry=>{
   const meta=leagueAssetPath(entry.path);
   const encodedPath=entry.path.split('/').map(encodeURIComponent).join('/');
   const url='https://raw.githubusercontent.com/'+source.repository+'/'+source.branch+'/'+encodedPath;
   return {
    sourceId:sourceKey(source),
    commitSha,
    collection:meta.leagueName,
    path:entry.path,
    name:entry.path.split('/').pop(),
    group:meta.leagueName,
    era:meta.leagueName,
    kind:meta.kind,
    url,
    local:url+'?v='+entry.sha+(force?'&reset='+Date.now():''),
    aliases:[]
   };
  });

  writeGitHubCache(key,loaded);
  return {assets:loaded};
 }catch(error){
  const stale=readGitHubCache(key,GITHUB_TREE_CACHE_TTL,true);
  if(stale&&Array.isArray(stale.data)&&stale.data.length){
   return {assets:stale.data,fromCache:true,warning:'Using the last saved image list for '+source.repository+'. '+error.message};
  }
  throw error;
 }
}

function archiveSourceEditor(parent){
 const tabsCard=el('section','card archive-source-card'),tabs=el('div','archive-source-tabs'),onlineTab=el('button','','GitHub / Online'),localTab=el('button','','Local Sources'),panel=el('div','archive-source-panel');
 onlineTab.type=localTab.type='button';onlineTab.setAttribute('role','tab');localTab.setAttribute('role','tab');tabs.setAttribute('role','tablist');tabs.append(onlineTab,localTab);tabsCard.append(tabs);parent.append(tabsCard,panel);

 const show=mode=>{
  archiveSourceTab=mode;onlineTab.setAttribute('aria-selected',String(mode==='online'));localTab.setAttribute('aria-selected',String(mode==='local'));panel.replaceChildren();

  if(mode==='online'){
   const step4=archiveStepCard(4,'Push the League Folder to GitHub','Upload the extracted league folder to a public GitHub repository. Private repositories cannot be connected.');
   panel.append(step4);

   const step5=archiveStepCard(5,'Paste Your Repository','Paste owner/repository or a GitHub URL. Available branches will load automatically.');
   const fields=el('div','fields archive-source-fields'),repo=el('input'),branch=el('select'),branchStatus=el('small','archive-branch-status','Enter a public repository to load branches.'),add=el('button','primary','Add Repository');
   repo.placeholder='owner/repository or GitHub URL';
   branch.disabled=true;add.type='button';add.disabled=true;
   branch.append(el('option','','Enter repository first'));
   const repoLabel=el('label','field'),branchLabel=el('label','field'),branchRow=el('div','archive-branch-row');
   repoLabel.append(el('span','','Repository'),repo);
   branchRow.append(branch,add);branchLabel.append(el('span','','Branch'),branchRow,branchStatus);
   fields.append(repoLabel,branchLabel);step5.append(fields);panel.append(step5);

   let branchRequest=0,branchTimer,branchLoadPromise=null,branchLoadRepo='';
   const setBranchState=(message,isError=false)=>{
    branchStatus.textContent=message;
    branchStatus.classList.toggle('error',isError);
   };
   const syncAddState=()=>{add.disabled=!isValidGitHubRepositoryInput(repo.value)};
   const loadBranches=async()=>{
    const value=repo.value.trim(),normalized=normalizeGitHubRepository(value);
    clearTimeout(branchTimer);
    if(branch.dataset.repo===normalized&&!branch.disabled)return;
    if(branchLoadPromise&&branchLoadRepo===normalized)return branchLoadPromise;
    const request=++branchRequest;
    branchLoadRepo=normalized;
    branch.replaceChildren();branch.disabled=true;
    branchLoadPromise=(async()=>{
    if(!isValidGitHubRepositoryInput(repo.value)||!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(normalized)){
     branch.append(el('option','','Enter repository first'));
     setBranchState('Enter a public repository to load branches.');
     syncAddState();
     return;
    }
    branch.append(el('option','','Loading branches…'));setBranchState('Checking public repository…');
    try{
     const result=await fetchPublicGitHubBranches(normalized);
     if(request!==branchRequest)return;
     repo.value=result.repository;
     branch.replaceChildren();
     if(!result.branches.length){
      branch.append(el('option','','No branches found'));setBranchState('No branches found in this repository.',true);return;
     }
     for(const name of result.branches){const option=el('option','',name);option.value=name;branch.append(option)}
     branch.value=result.defaultBranch&&result.branches.includes(result.defaultBranch)?result.defaultBranch:result.branches[0];
     branch.dataset.repo=result.repository;branch.disabled=false;syncAddState();
     setBranchState(result.warning||'',Boolean(result.warning));
    }catch(error){
     if(request!==branchRequest)return;
     branch.replaceChildren();branch.append(el('option','','Branches unavailable'));branch.disabled=true;setBranchState(error.message,true);
    }finally{
     if(branchLoadRepo===normalized){branchLoadPromise=null;branchLoadRepo=''}
    }
    })();
    return branchLoadPromise;
   };
   repo.addEventListener('input',()=>{
    branchRequest++;branch.dataset.repo='';branchLoadPromise=null;branchLoadRepo='';
    branch.replaceChildren();branch.append(el('option','','Repository entered'));branch.disabled=true;setBranchState('Branches load when you finish the repository field.');
    clearTimeout(branchTimer);syncAddState();
   });
      syncAddState();
   repo.addEventListener('paste',()=>{clearTimeout(branchTimer);branchTimer=setTimeout(()=>void loadBranches(),50)});
   repo.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();clearTimeout(branchTimer);void loadBranches()}});
   repo.addEventListener('change',()=>void loadBranches());
   repo.addEventListener('blur',()=>{if(document.activeElement!==branch)void loadBranches()});

   add.onclick=async()=>{
    if(archiveRefreshing)return;
    const repository=normalizeGitHubRepository(repo.value);
    if(!isValidGitHubRepositoryInput(repo.value)||!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)){toast('Enter owner/repository or a GitHub repository URL.');syncAddState();return}
    add.disabled=true;
    try{
     if(branch.disabled||!branch.value.trim())await loadBranches();
     const selectedBranch=branch.value.trim();
     if(branch.disabled||!selectedBranch){toast(branchStatus.textContent||'Could not load a branch for this repository.');return}
     const source={repository:normalizeGitHubRepository(repo.value),branch:selectedBranch,folders:[]};
     archiveSources=archiveSources.filter(s=>sourceKey(s)!==sourceKey(source));archiveSources.push(source);archiveSourceTab='online';dirty=true;
     await refreshArchive();
    }finally{
     if(document.body.contains(add))syncAddState();
    }
   };
  }else{
   const step4=archiveStepCard(4,'Choose the League Folder','Choose the league folder or its parent folder.');
   localAssetImporter(step4);panel.append(step4);
  }
 };
 onlineTab.onclick=()=>show('online');localTab.onclick=()=>show('local');show(archiveSourceTab);
}

let archiveRefreshing=false;
async function refreshArchive(quiet=false,force=false){
 if(archiveRefreshing)return;
 if(!archiveSources.length){
  if(!localAssets.length){if(!quiet)toast('Add a source to start your archive.');return}
  assets=[...localAssets];syncArchiveList();if(view==='images')render();
  if(!quiet)toast(force?'Library reset: '+assets.length+' images restored.':'Local library restored: '+assets.length+' images.');
  return;
 }
 archiveRefreshing=true;
 const result=[...localAssets],failures=[],warnings=[];
 try{
  for(const source of archiveSources){
   try{
    const loaded=await loadArchiveSource(source,force);
    result.push(...loaded.assets);
    if(loaded.warning)warnings.push(loaded.warning);
   }catch(error){
    failures.push(source.repository+': '+error.message);
    result.push(...assets.filter(a=>a.sourceId===sourceKey(source)));
   }
  }
  assets=result;syncArchiveList();if(view==='images')render();
  if(failures.length)toast(failures[0]);
  else if(warnings.length)toast(warnings[0]);
  else if(!quiet)toast(force?'Library reset: '+assets.length+' images restored.':'Online sources updated: '+assets.length+' images.');
 }finally{archiveRefreshing=false}
}

function archiveLeague(asset){return asset.collection||asset.group||leagueAssetPath(asset.path)?.leagueName||'Unnamed league'}
function renderArchive(){
 renderPageNav();$('#status').hidden=true;$('#title').textContent='Image Archive';$('#breadcrumb').textContent='ASSETS / ARCHIVE';$('#subtitle').textContent='Manage logos, courts, and ads for your leagues.';
 let archiveStatus=$('#archiveStatus');
 if(!archiveStatus){archiveStatus=el('span','badge','No Library Loaded');archiveStatus.id='archiveStatus';$('#status').parentElement.append(archiveStatus)}
 archiveStatus.hidden=assets.length>0;
 const c=$('#content'),setup=el('details','archive-setup'),setupSummary=el('summary','archive-setup-summary'),setupLabel=el('span','','Start Here'),setupArrow=el('span','archive-setup-arrow','▼'),setupBody=el('div','archive-setup-body'),filters=el('div','filters'),search=el('input');
 search.placeholder='Search images…';search.setAttribute('aria-label','Search images');
 const kind=el('select'),group=el('select');group.setAttribute('aria-label','League Name');
 for(const s of ['All leagues',...new Set(assets.map(archiveLeague).filter(Boolean))]){const option=el('option','',s);option.value=s;group.append(option)}
 kind.setAttribute('aria-label','Image type');for(const s of ['All types','Logos','Courts','Ads'])kind.append(el('option','',s));
 let managing=false;
 const manage=el('button','archive-manage-button','Manage');manage.type='button';manage.setAttribute('aria-pressed','false');
 manage.onclick=()=>{managing=!managing;manage.textContent=managing?'Done':'Manage';manage.setAttribute('aria-pressed',String(managing));draw()};
 const refresh=el('button','','Reset Library');refresh.type='button';refresh.disabled=!archiveSources.length&&!localAssets.length;refresh.onclick=()=>refreshArchive(false,true);
 filters.append(search,group,kind,refresh,manage);
 const grid=el('div','gallery'),count=el('p','note');count.setAttribute('role','status');count.setAttribute('aria-live','polite');
 setupSummary.append(setupLabel,setupArrow);setup.append(setupSummary,setupBody);c.append(setup);archiveSetupSteps(setupBody);archiveSourceEditor(setupBody);renderConnectedSources(c);c.append(el('h2','archive-library-heading','Image Library'),filters,count,grid);
 function draw(){
  archiveStatus.hidden=assets.length>0;
  grid.replaceChildren();
  const matches=assets.filter(a=>(group.value==='All leagues'||archiveLeague(a)===group.value)&&(kind.value==='All types'||a.kind===kind.value)&&(a.name+' '+a.path).toLowerCase().includes(search.value.toLowerCase()));
  count.textContent=matches.length+' '+(matches.length===1?'image':'images')+' shown · '+assets.length+' total'+(managing?' · Manage mode':'');
  for(const a of matches){
   const card=el('article','asset'),img=el('img');img.src=a.local;img.alt=a.name;img.loading='lazy';
   const remove=el('button','asset-manage-remove','−');remove.type='button';remove.hidden=!managing;remove.setAttribute('aria-label','Remove '+a.name+' from library');remove.title='Remove from library';
   remove.onclick=()=>{
    const index=assets.indexOf(a);if(index<0)return;
    assets.splice(index,1);syncArchiveList();dirty=true;draw();toast(a.name+' removed. Use Reset Library to restore it.');
   };
   const body=el('div','asset-body'),dimensions=el('small','archive-image-dimensions');
   const showDimensions=()=>{const width=Number(a.width)||img.naturalWidth,height=Number(a.height)||img.naturalHeight;if(width>0&&height>0){a.width=width;a.height=height;dimensions.textContent=width+' × '+height+' px'}else dimensions.textContent='Dimensions unavailable'};
   if(Number(a.width)>0&&Number(a.height)>0)showDimensions();else dimensions.textContent='Loading dimensions…';
   img.addEventListener('load',showDimensions,{once:true});img.addEventListener('error',()=>{dimensions.textContent='Dimensions unavailable'},{once:true});
   body.append(el('h3','',label(a.name)),dimensions,el('p','',`${archiveLeague(a)} / ${a.kind}`));
   card.append(img);previewBackgroundToggle(img,card);card.append(remove,body);grid.append(card);
  }
  if(!matches.length)grid.append(el('p','',assets.length?'No images match these filters.':'No images yet. Add an online or local source above.'));
 }
 search.oninput=group.onchange=kind.onchange=draw;draw();
}
function saveFile(name,text){const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function validate(data){if(!data||typeof data!=='object'||Array.isArray(data)||typeof data.leagueName!=='string'||!Array.isArray(data.teams)||!data.teams.length||!Array.isArray(data.conferences)||!Array.isArray(data.divisions))throw Error('Choose a Hoopland league file with a league name, teams, conferences and divisions.');if(data.teams.some(t=>!t||typeof t!=='object'||Array.isArray(t)))throw Error('The file contains an invalid team.');if(data.teams.length>64)throw Error('This editor supports a maximum of 64 league teams.');return data}
function importLeagueText(text){
 let data;try{data=JSON.parse(text.replace(/^\uFEFF/,''))}catch{throw Error('This file is not valid league JSON. Choose a Hoop Land .txt or .json league file.')}
 data=validate(data);inferImportedSliderPresets(data);
 if(dirty&&!confirm('Replace your current edits with this league?'))return false;
 load(data);toast('League imported');return true;
}
function leagueImportURL(value){
 let url;try{url=new URL(value.trim())}catch{throw Error('Enter a complete GitHub raw file URL.')}
 if(url.protocol!=='https:'||url.hostname!=='raw.githubusercontent.com'||url.username||url.password||url.port)throw Error('Use an HTTPS raw.githubusercontent.com file URL.');
 if(url.pathname.split('/').filter(Boolean).length<4)throw Error('The URL must point to a league file in a GitHub repository.');
 return url.href;
}
function openLeagueImport(){
 const dialog=el('dialog','draft-dialog'),heading=el('h2','','Import League'),close=el('button','','Close');
 heading.id='league-import-title';dialog.setAttribute('aria-labelledby',heading.id);
 const file=el('input'),fileLabel=el('label','field'),fileTitle=el('span','','Upload a league file');file.type='file';file.accept='.txt,.json';fileLabel.append(fileTitle,file);
 const form=el('form'),urlLabel=el('label','field'),urlTitle=el('span','','GitHub raw file URL'),url=el('input'),submit=el('button','primary','Import from URL');
 url.type='url';url.required=true;url.placeholder='https://raw.githubusercontent.com/owner/repository/main/league.txt';url.autocomplete='off';urlLabel.append(urlTitle,url);submit.type='submit';
 form.append(urlLabel,el('p','','Paste the raw link to a public GitHub league file.'),submit);
 const message=el('p');message.setAttribute('role','status');message.setAttribute('aria-live','polite');
 close.type='button';close.onclick=()=>dialog.close();dialog.append(heading,fileLabel,el('p','','Or import from GitHub'),form,message,close);
 let busy=false,controller;
 const setBusy=value=>{busy=value;file.disabled=value;url.disabled=value;submit.disabled=value;dialog.setAttribute('aria-busy',String(value))};
 const run=async read=>{
  if(busy)return;setBusy(true);message.textContent='Importing league…';
  try{const text=await read();if(!dialog.open)return;if(importLeagueText(text))dialog.close();else message.textContent='Import canceled. Your current league is unchanged.'}
  catch(error){if(dialog.open)message.textContent=error.message}
  finally{setBusy(false);file.value=''}
 };
 file.onchange=()=>{const selected=file.files[0];if(selected)void run(()=>selected.text())};
 form.onsubmit=event=>{event.preventDefault();void run(async()=>{
  const address=leagueImportURL(url.value);controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),30000);
  try{const response=await fetch(address,{signal:controller.signal,credentials:'omit',cache:'no-store'});if(!response.ok)throw Error('Could not download the league (HTTP '+response.status+'). Check that the raw file is public and the link is correct.');return await response.text()}
  catch(error){if(error.name==='AbortError')throw Error('The download timed out. Try again or upload the league file.');if(error instanceof TypeError)throw Error('Could not reach GitHub. Check your connection or upload the league file.');throw error}
  finally{clearTimeout(timeout)}
 })};
 dialog.addEventListener('close',()=>{controller?.abort();dialog.remove()});document.body.append(dialog);dialog.showModal();
}
function load(data,optimizeLineups=false){league=validate(data);const awardsChanged=league.leagueType===1&&adaptDefaultAwards(league);normalizeLexingtonLocations(league);const lineupsChanged=window.HLSRatings?.rebuildLineups(league,optimizeLineups)||0;normalizeTeamHoopGramTags(league);leagueRetiredNumbers(league);syncTeamCountMeta(league);activeDraftSlot=null;locationSelections.clear();selected=0;teamList='teams';view='league';dirty=!!lineupsChanged||awardsChanged;$('#status').textContent=lineupsChanged?'Lineups updated · Unsaved changes':awardsChanged?'College awards updated · Unsaved changes':'Ready to edit';render()}
let activeDraftSlot=null;
function draftStore(mode,record,slot=0){
 if(!Number.isInteger(slot)||slot<0||slot>2)return Promise.reject(Error('Invalid save slot'));const key=slot===0?'current':'slot-'+slot;
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open('HooplandLeagueStudioDrafts',1);
  request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('drafts'))db.createObjectStore('drafts')};
  request.onerror=()=>reject(request.error||Error('Browser storage is unavailable.'));
  request.onblocked=()=>reject(Error('Close other copies of the editor and try again.'));
  request.onsuccess=()=>{const db=request.result;let tx,result;try{tx=db.transaction('drafts',mode==='delete'?'readwrite':mode);const store=tx.objectStore('drafts');const operation=mode==='delete'?store.delete(key):mode==='readwrite'?store.put(record,key):store.get(key);operation.onsuccess=()=>{result=operation.result};tx.oncomplete=()=>{db.close();resolve(result)};tx.onabort=tx.onerror=()=>{db.close();reject(tx.error||Error('Could not access the saved draft.'))}}catch(error){db.close();reject(error)}};
 });
}
function draftSnapshot(){return {version:2,lotteryMode:{...lotteryMode(league)},archiveSources:structuredClone(archiveSources),localAssets:structuredClone(localAssets),archiveSource:structuredClone(archiveSource),savedAt:new Date().toISOString(),league:structuredClone(league)}}
async function openDraftSlots(mode){
 if(mode==='save'&&(!league||!canNavigate()))return;
 const dialog=el('dialog','draft-dialog '+(mode==='restore'?'load-league-dialog':'save-league-dialog')),heading=el('h2','',mode==='save'?'Save League':'Load League'),close=el('button','','Close'),list=el('div'),message=el('p','','Loading saved leagues…');heading.id='draft-dialog-title';dialog.setAttribute('aria-labelledby',heading.id);message.setAttribute('role','status');close.type='button';close.onclick=()=>dialog.close();dialog.append(heading,message,list,close);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();let busy=false;dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault()});
 try{const records=await Promise.all([0,1,2].map(slot=>draftStore('readonly',undefined,slot)));if(!dialog.open)return;message.textContent=mode==='save'?'Choose one of three slots. Saves stay in this browser.':'Choose a saved league to load.';
 records.forEach((record,slot)=>{const button=el('button','draft-slot'),name=record?.league?.leagueName||'Empty slot';button.type='button';button.append(el('strong','','Slot '+(slot+1)+' — '+name),el('small','',record?'Saved '+new Date(record.savedAt).toLocaleString():'Available for a new league'));if(slot===activeDraftSlot)button.append(el('small','','Current league slot'));button.disabled=mode==='restore'&&!record;const row=el('div','draft-row');list.append(row);row.append(button);if(record){const remove=el('button','draft-delete','Delete');remove.type='button';remove.setAttribute('aria-label','Delete '+name+' from slot '+(slot+1));row.append(remove);remove.onclick=async()=>{if(busy||!confirm('Delete “'+name+'” from slot '+(slot+1)+'? This cannot be undone.'))return;busy=true;close.disabled=true;try{await draftStore('delete',undefined,slot);if(activeDraftSlot===slot){activeDraftSlot=null;if(league){dirty=true;$('#status').textContent='Current league has no saved slot'}}dialog.close();toast('Slot '+(slot+1)+' deleted.');void openDraftSlots(mode)}catch(error){message.textContent='Could not delete save: '+error.message}finally{busy=false;close.disabled=false}}}
 button.onclick=async()=>{if(busy)return;if(mode==='save'&&record&&slot!==activeDraftSlot&&!confirm('Replace “'+name+'” in slot '+(slot+1)+'?'))return;if(mode==='restore'&&dirty&&!confirm('Replace your unsaved changes with “'+name+'”?'))return;
 if(mode==='restore'&&archiveRefreshing){message.textContent='The archive is updating. Try again once it finishes.';return}
 busy=true;close.disabled=true;for(const row of list.children)for(const child of row.children)child.disabled=true;
 try{if(mode==='save'){
 const owner=league,record=draftSnapshot(),snapshot=JSON.stringify(record.league);await draftStore('readwrite',record,slot);activeDraftSlot=slot;if(league===owner&&JSON.stringify(league)===snapshot){dirty=false;$('#status').textContent='Saved to slot '+(slot+1)}toast('Progress saved to slot '+(slot+1));
 }else{
 const restored=validate(structuredClone(record.league));archiveSources=structuredClone(record.archiveSources||(record.archiveSource?.repository?[record.archiveSource]:[]));localAssets=structuredClone(record.localAssets||[]).map(a=>({...a,url:a.url||a.local}));archiveSource=structuredClone(record.archiveSource||{repository:'',branch:'main',folders:[]});assets=[...localAssets];syncArchiveList();lotteryModes.set(restored,{teams:record.lotteryMode?.teams===true,odds:record.lotteryMode?.odds===true});load(restored);activeDraftSlot=slot;$('#status').textContent='Restored slot '+(slot+1)+(dirty?' · Unsaved changes':'');void refreshArchive(true);toast('Saved league restored.');
 }dialog.close();
 }catch(error){message.textContent='Could not '+mode+' progress: '+error.message;for(const [i,row]of [...list.children].entries()){row.children[0].disabled=mode==='restore'&&!records[i];if(row.children[1])row.children[1].disabled=false}}finally{busy=false;close.disabled=false}
 };
 });
 }catch(error){message.textContent='Could not read saved leagues: '+error.message}
}
$('#saveProgress').onclick=()=>openDraftSlots('save');
$('#restoreProgress').onclick=()=>openDraftSlots('restore');

$('#gettingStartedNav').onclick=()=>{if(canNavigate()){view='home';render()}};$('#leagueNav').onclick=()=>{if(canNavigate()){view='league';render()}};$('#sidebarTemplate').onclick=()=>$('#new').click();$('#sidebarImport').onclick=()=>$('#import').click();$('#sidebarRestore').onclick=()=>$('#restoreProgress').click();$('#imagesNav').onclick=()=>{if(canNavigate()){view='images';render()}};$('#teamSearch').oninput=()=>league&&listTeams();$('#import').onclick=openLeagueImport;$('#new').onclick=async()=>{if(dirty&&!confirm('Discard current edits and create a new league?'))return;const settings=await chooseNewLeagueSettings();if(!settings)return;const button=$('#new');button.disabled=true;const genderLabel=['male','female','mixed'][settings.gender];$('#status').textContent='Generating '+(settings.type===1?'College':'Pro')+' '+genderLabel+' teams and players…';try{const next=await generateNewLeague(settings.type,settings.gender);load(next,true);render();toast((settings.type===1?'College':'Pro')+' '+genderLabel+' league created with '+next.teams.length+' fresh teams and '+next.teams.reduce((sum,team)=>sum+team.roster.length,0)+' generated players.')}catch(e){$('#status').textContent=league?'Ready to edit':'Could not create league';toast(e.message);alert(e.message)}finally{button.disabled=false}};window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
$('#export').onclick=async()=>{if(!league||!canNavigate())return;if(league.teams.length<4){toast('A league needs at least 4 teams before export.');return}syncTeamCountMeta();const original=JSON.stringify(league);$('#export').disabled=true;$('#status').textContent='Checking images…';try{validateActiveRosterIds(league);const ready=await prepareImages(league,assets);validateActiveRosterIds(ready);if(JSON.stringify(league)!==original)throw Error('The league changed during image checks. Export again to include your latest edits.');enforcePlayInRounds(ready);lotteryModes.set(ready,{...lotteryMode(league)});league=ready;saveFile((league.leagueName||'League').replace(/[<>:"/\\|?*]/g,'_')+'.txt',JSON.stringify(ready));dirty=false;$('#status').textContent='Exported';render();toast('Exported with verified image links and logo dimensions.')}catch(e){$('#status').textContent='Export needs attention';toast(e.message);alert(e.message)}finally{$('#export').disabled=false}};

function pickerTeamForPath(path){
 return path?.[0]==='teams'||path?.[0]==='starTeams'?league?.[path[0]]?.[path[1]]:null;
}
function pickerLogoSource(team){
 const raw=String(team?.logoURL??'').trim();
 return raw?archiveURL(raw,assets):'';
}
function pickerLoadElement(source,useCORS=true){
 return new Promise((resolve,reject)=>{
  const img=new Image(),timer=setTimeout(()=>{
   img.onload=img.onerror=null;
   reject(Error('Team logo request timed out.'));
  },15000);
  if(useCORS&&/^https?:/i.test(source)){
   img.crossOrigin='anonymous';
   img.referrerPolicy='no-referrer';
  }
  img.onload=()=>{clearTimeout(timer);resolve(img)};
  img.onerror=()=>{clearTimeout(timer);reject(Error('Team logo could not be loaded.'))};
  img.src=source;
 });
}
function pickerBlobToDataURL(blob){
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(String(reader.result||''));
  reader.onerror=()=>reject(reader.error||Error('Could not read team logo data.'));
  reader.readAsDataURL(blob);
 });
}
async function pickerFetchAsDataURL(source){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetch(source,{mode:'cors',cache:'reload',signal:controller.signal});
  if(!response.ok)throw Error('Image request returned '+response.status);
  const blob=await response.blob();
  if(!blob.size)throw Error('Image response was empty.');
  return await pickerBlobToDataURL(blob);
 }finally{clearTimeout(timer)}
}
function pickerCanvasWrap(){return $('#canvas').parentElement}
function clearPickerImage(message=''){
 pickerLoadToken++;
 imageReady=false;
 const canvas=$('#canvas'),zoom=$('#zoom'),wrap=pickerCanvasWrap();
 canvas.width=1;canvas.height=1;
 canvas.getContext('2d').clearRect(0,0,1,1);
 zoom.getContext('2d').clearRect(0,0,zoom.width,zoom.height);
 zoom.hidden=true;
 wrap.hidden=true;
 $('#palette').replaceChildren();
 if(message)$('#pickHelp').textContent=message;
}
function pickerBuildPalette(ctx,width,height){
 const bins=new Map(),step=Math.max(1,Math.floor(Math.sqrt((width*height)/60000)));
 const pixels=ctx.getImageData(0,0,width,height).data;
 for(let y=0;y<height;y+=step){
  for(let x=0;x<width;x+=step){
   const i=(y*width+x)*4;
   if(pixels[i+3]<200)continue;
   const r=Math.round(pixels[i]/8)*8,g=Math.round(pixels[i+1]/8)*8,b=Math.round(pixels[i+2]/8)*8;
   const hex=[Math.min(r,255),Math.min(g,255),Math.min(b,255)]
    .map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();
   bins.set(hex,(bins.get(hex)||0)+1);
  }
 }
 const palette=$('#palette');palette.replaceChildren();
 for(const [hex] of [...bins].sort((a,b)=>b[1]-a[1]).slice(0,10)){
  const button=el('button');button.type='button';button.style.background='#'+hex;button.title=hex;
  button.setAttribute('aria-label','Select '+hex);button.onclick=()=>sampled(hex);palette.append(button);
 }
}
function pickerDrawImage(img){
 if(!img?.naturalWidth||!img?.naturalHeight)throw Error('Team logo has invalid dimensions.');
 const canvas=$('#canvas');
 canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 ctx.clearRect(0,0,canvas.width,canvas.height);
 ctx.imageSmoothingEnabled=true;
 ctx.drawImage(img,0,0);
 // This intentionally verifies that the canvas is readable for color sampling.
 ctx.getImageData(0,0,1,1);
 pickerBuildPalette(ctx,canvas.width,canvas.height);
}
async function loadPickerTeamLogo(){
 const token=++pickerLoadToken,team=pickerTeam,source=pickerLogoSource(team),wrap=pickerCanvasWrap(),zoom=$('#zoom');
 imageReady=false;wrap.hidden=true;zoom.hidden=true;$('#palette').replaceChildren();

 if(!String(team?.logoURL??'').trim()){
  clearPickerImage('This team does not have a Logo URL.');
  return;
 }
 if(!/^(https?:|data:image\/|blob:)/i.test(source)){
  clearPickerImage('This team does not have a readable Logo URL.');
  return;
 }

 $('#pickHelp').textContent='Loading team logo…';

 // First use the exact team logo URL, the same source shown by the normal preview.
 try{
  const direct=await pickerLoadElement(source,true);
  if(token!==pickerLoadToken)return;
  pickerDrawImage(direct);
  imageReady=true;wrap.hidden=false;zoom.hidden=true;
  $('#pickHelp').textContent='Tap or click a color in the team logo.';
  return;
 }catch(directError){
  // Safari can display a remote image but still refuse pixel reads. Fetching it
  // into a local data URL gives the canvas a same-origin source.
  try{
   if(!/^https?:/i.test(source))throw directError;
   const localSource=await pickerFetchAsDataURL(source);
   if(token!==pickerLoadToken)return;
   const local=await pickerLoadElement(localSource,false);
   if(token!==pickerLoadToken)return;
   pickerDrawImage(local);
   imageReady=true;wrap.hidden=false;zoom.hidden=true;
   $('#pickHelp').textContent='Tap or click a color in the team logo.';
   return;
  }catch(fallbackError){
   if(token!==pickerLoadToken)return;
   clearPickerImage('Could not load the team logo for color sampling.');
   console.warn('Team logo color picker:',directError,fallbackError);
  }
 }
}
function pickerSelectedHex(){
 const value=String(get(pickPath)??'').toUpperCase();
 return /^[A-F0-9]{6}$/.test(value)?value:'FFFFFF';
}
function syncPickerSelectedColor(){
 const hex=pickerSelectedHex();
 $('#sampleHex').value=hex;
 $('#sampleColor').value='#'+hex;
}
function resetPicker(){
 if(teamPicker&&pickerOriginalColors&&pickPath){
  const base=pickPath.slice(0,-1),restored=structuredClone(pickerOriginalColors);
  set(base,restored);
  for(let i=0;i<3;i++){
   const hex=String(restored[i]??'').toUpperCase();
   refreshColorFields([...base,String(i)],hex);
  }
 }else if(pickPath&&pickerOriginalValue!==null){
  set(pickPath,structuredClone(pickerOriginalValue));
  refreshColorFields(pickPath,String(pickerOriginalValue??'').toUpperCase());
 }
 syncPickerSelectedColor();
 void loadPickerTeamLogo();
 toast('Colors reset.');
}
function openPicker(path){
 pickPath=[...path];
 teamPicker=pickPath.includes('teamColors');
 pickerTeam=pickerTeamForPath(pickPath);
 pickerOriginalColors=teamPicker?structuredClone(get(pickPath.slice(0,-1))):null;
 pickerOriginalValue=teamPicker?null:structuredClone(get(pickPath));
 $('#pickTarget').replaceChildren();
 if(teamPicker)renderColorTargets($('#pickTarget'),pickPath.slice(0,-1));
 else $('#pickTarget').textContent=pickPath.map(label).join(' / ');
 $('#applyColor').textContent=teamPicker?'Done':'Apply color';
 $('#resetColorPicker').onclick=resetPicker;
 syncPickerSelectedColor();
 renderRecent();
 $('#picker').showModal();
 void loadPickerTeamLogo();
}
function sampled(hex){
 hex=String(hex??'').replace(/^#/,'').toUpperCase();
 if(!/^[A-F0-9]{6}$/.test(hex))return;
 $('#sampleHex').value=hex;$('#sampleColor').value='#'+hex;
 set(pickPath,hex);
 refreshColorFields(pickPath,hex);
 rememberColor(hex);
}
function rememberColor(hex){
 hex=String(hex).toUpperCase();
 recent=[hex,...recent.filter(h=>h!==hex)].slice(0,12);
 renderRecent();
}
function refreshColorFields(path,hex){
 const upper=String(hex??'').toUpperCase();
 for(const node of document.querySelectorAll('[data-path]')){
  if(node.dataset.path===JSON.stringify(path)){
   node.value=upper;
   const swatch=node.parentElement.querySelector('input[type=color]');
   if(swatch&&/^[A-F0-9]{6}$/.test(upper))swatch.value='#'+upper;
   node.closest('.field')?.classList.remove('invalid');
  }
 }
 const colorPath=path.slice(0,-1),colors=get(colorPath);
 for(const b of document.querySelectorAll('[data-color-slot]')){
  const value=colors?.[Number(b.dataset.colorSlot)];
  b.style.setProperty('--slot-color',/^[a-f0-9]{6}$/i.test(value)?'#'+value:'#768077');
 }
}
function selectColorSlot(index,path){
 teamColorSlot=index;pickPath=[...path,String(index)];
 for(const b of document.querySelectorAll('[data-color-slot]')){
  const selected=Number(b.dataset.colorSlot)===index;
  b.setAttribute('aria-checked',String(selected));b.classList.toggle('selected',selected);
 }
 syncPickerSelectedColor();
}
function renderColorTargets(parent,path){
 const row=el('div','color-targets');row.setAttribute('role','radiogroup');row.setAttribute('aria-label','Color to update');
 for(let i=0;i<3;i++){
  const b=el('button','color-target',['Primary','Secondary','Tertiary'][i]);b.type='button';b.dataset.colorSlot=i;
  b.setAttribute('role','radio');b.setAttribute('aria-checked',String(teamColorSlot===i));b.classList.toggle('selected',teamColorSlot===i);
  const value=get(path)?.[i];b.style.setProperty('--slot-color',/^[a-f0-9]{6}$/i.test(value)?'#'+value:'#768077');
  b.onclick=()=>selectColorSlot(i,path);
  b.onkeydown=e=>{
   if(!['ArrowRight','ArrowDown','ArrowLeft','ArrowUp'].includes(e.key))return;
   e.preventDefault();const n=(i+(['ArrowRight','ArrowDown'].includes(e.key)?1:2))%3;
   selectColorSlot(n,path);row.children[n].focus();
  };
  row.append(b);
 }
 parent.append(row);
}
function renderTeamColors(parent,path){
 const fields=el('div','fields team-color-fields');
 for(let i=0;i<3;i++){
  const wrap=el('label','field');wrap.append(el('span','',['Primary','Secondary','Tertiary'][i]));
  const row=el('div','color-line'),swatch=el('input'),input=el('input'),p=[...path,String(i)],value=get(path)[i]??'';
  swatch.type='color';swatch.value=/^[a-f0-9]{6}$/i.test(value)?'#'+value:'#ffffff';swatch.setAttribute('aria-label',['Primary','Secondary','Tertiary'][i]+' color');
  input.value=value;input.maxLength=6;input.setAttribute('aria-label',['Primary','Secondary','Tertiary'][i]+' hex');input.dataset.path=JSON.stringify(p);
  input.onfocus=()=>selectColorSlot(i,path);
  input.oninput=()=>{if(/^[a-f0-9]{6}$/i.test(input.value)){set(p,input.value.toUpperCase());swatch.value='#'+input.value;wrap.classList.remove('invalid');refreshColorFields(p,input.value)}else wrap.classList.add('invalid')};
  swatch.oninput=()=>{set(p,swatch.value.slice(1).toUpperCase());refreshColorFields(p,swatch.value.slice(1))};
  row.append(swatch,input);wrap.append(row);fields.append(wrap);
 }
 parent.append(fields);
 const pick=el('button','primary','Pick colors from team logo');pick.type='button';pick.onclick=()=>{if(canNavigate())openPicker([...path,String(teamColorSlot)])};
 parent.append(pick,el('p','','Select Primary, Secondary or Tertiary, then tap or click a color in the team logo.'));
}
function renderRecent(){
 const r=$('#recent');r.replaceChildren();
 for(const hex of recent){
  const b=el('button');b.type='button';b.style.background='#'+hex;b.title=hex;b.setAttribute('aria-label','Select '+hex);b.onclick=()=>sampled(hex);r.append(b);
 }
}
function pickerCanvasPoint(event){
 const canvas=$('#canvas'),rect=canvas.getBoundingClientRect();
 if(!rect.width||!rect.height)return null;
 const x=Math.max(0,Math.min(canvas.width-1,Math.floor((event.clientX-rect.left)*canvas.width/rect.width)));
 const y=Math.max(0,Math.min(canvas.height-1,Math.floor((event.clientY-rect.top)*canvas.height/rect.height)));
 return {x,y};
}
function updatePickerZoom(event){
 if(!imageReady)return;
 const point=pickerCanvasPoint(event);if(!point)return;
 const canvas=$('#canvas'),zoom=$('#zoom'),z=zoom.getContext('2d');
 zoom.hidden=false;z.imageSmoothingEnabled=false;z.clearRect(0,0,zoom.width,zoom.height);
 z.drawImage(canvas,point.x-5,point.y-5,11,11,0,0,zoom.width,zoom.height);
 z.strokeStyle='red';z.lineWidth=2;z.strokeRect(45,45,10,10);
}
function pickCanvasColor(event){
 if(!imageReady)return;
 const point=pickerCanvasPoint(event);if(!point)return;
 const pixel=$('#canvas').getContext('2d',{willReadFrequently:true}).getImageData(point.x,point.y,1,1).data;
 if(pixel[3]<32){toast('Choose a non-transparent pixel.');return}
 sampled([pixel[0],pixel[1],pixel[2]].map(v=>v.toString(16).padStart(2,'0')).join(''));
}
const pickerCanvas=$('#canvas');
pickerCanvas.addEventListener('pointermove',updatePickerZoom);
pickerCanvas.addEventListener('pointerdown',event=>{
 if(!imageReady)return;
 event.preventDefault();
 try{pickerCanvas.setPointerCapture(event.pointerId)}catch{}
 updatePickerZoom(event);pickCanvasColor(event);
});
pickerCanvas.addEventListener('pointerleave',()=>{$('#zoom').hidden=true});
$('#resetColorPicker').onclick=resetPicker;
$('#closePicker').onclick=()=>{$('#picker').close();pickerLoadToken++};
$('#sampleColor').oninput=e=>sampled(e.target.value);
$('#sampleHex').onchange=()=>{
 const hex=$('#sampleHex').value.trim().replace(/^#/,'');
 if(/^[a-f0-9]{6}$/i.test(hex))sampled(hex);else{syncPickerSelectedColor();toast('Enter a six-digit hex color.')}
};
$('#applyColor').onclick=()=>{
 if(teamPicker){$('#picker').close();pickerLoadToken++;return}
 const hex=$('#sampleHex').value.trim().replace(/^#/,'');
 if(!/^[a-f0-9]{6}$/i.test(hex)){toast('Enter a six-digit hex color.');return}
 sampled(hex);$('#picker').close();pickerLoadToken++;toast('Color applied');
};
try{const [s,a]=await Promise.resolve([standaloneSample,[]]);template=structuredClone(s);applyScheduleDefaults(template,29);applySettingPreset(template,['settings','gameStyle'],template.settings.gameStyle);applySettingPreset(template,['season','simulationPreset'],template.season.simulationPreset);assets=a.sort((a,b)=>a.name.localeCompare(b.name)||a.path.localeCompare(b.path));$('#assetCount').textContent=assets.length;renderWelcome();void refreshArchive(true);}catch(e){$('#content').textContent=e.message;$('#status').textContent='Load error'}
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'list_league_teams',description:'Read the names and identifiers of the currently loaded league teams.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:input=>{if(!input||Object.keys(input).length)throw Error('Expected an empty object');return {league:league?.leagueName||null,teams:(league?.teams||[]).map(t=>({id:t.id,name:t.name,city:t.city}))}}})).catch(()=>{})}catch{}}

})().catch(error=>{document.getElementById('content').textContent=error.message;});
