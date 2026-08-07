import { allNeighborhoods } from '@/lib/neighborhoods'

export function slugifyNeighborhood(name: string): string {
  return name
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/\u2019/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

export function findNeighborhoodBySlug(slug: string): string | null {
  return allNeighborhoods.find((name) => slugifyNeighborhood(name) === slug) || null
}

const yeminMosheDsc = `One of Jerusalem's most distinctive and romantic neighbourhoods, Yemin Moshe was established in the 19th century as the first Jewish settlement outside the Old City walls. Its stone homes, red-tiled roofs, and flower-filled courtyards sit directly opposite the Old City walls, offering some of the most breathtaking views in Jerusalem. The neighbourhood is quiet, intimate, and beautifully preserved - ideal for couples, artists, and guests seeking an upscale stay in a setting that feels genuinely historic rather than curated. The Montefiore Windmill and the promenade along the valley are steps from your door.`

const talbiyaDsc = `One of Jerusalem's most refined residential addresses, built in the early 20th century with wide boulevards, mature trees, and grand stone villas. The neighbourhood sits adjacent to the President's Residence and within easy walking distance of the Jerusalem Theater, Mamilla, the King David Hotel, and the Old City. The atmosphere is calm and sophisticated - a neighbourhood where Jerusalem's cultural and professional establishment has lived for generations. Ideal for families and discerning travelers who want elegance, centrality, and a genuine sense of being in a real neighbourhood rather than a tourist zone.`

const shareiChessedDsc = `A prestigious and quietly beautiful neighbourhood tucked between Rechavia and Nachlaot, Sha'arei Chessed is characterised by elegant stone buildings, well-kept gardens, and a strong, established community. It has historically been home to prominent Torah scholars and its shuls - including the celebrated Beit Knesset HaGra - are among the most distinguished in Jerusalem. Centrally located and walkable to the city centre, yet genuinely tranquil, it appeals to international families and guests looking for refined residential living with easy access to everything Jerusalem offers.`

const rechaviaDsc = `One of Jerusalem's most beloved and established neighbourhoods - wide, tree-lined streets, graceful stone architecture, and a sense of cultivated calm that has defined the area since the 1920s. Its streets are named after medieval Jewish poets and scholars, and the neighbourhood carries that sense of deep rootedness. Sacher Park and Independence Park are a short stroll away, as are excellent cafes, the Mahane Yehuda market, and Ben Yehuda Street. Several well-regarded shuls serve the neighbourhood's established community. Ideal for families, longer-stay guests, and anyone who wants to feel genuinely at home in Jerusalem at its most elegant.`

const germanColonyDsc = `One of Jerusalem's most characterful and sought-after neighbourhoods for short-term stays. Originally established by German Templar settlers in the 1870s, it retains its distinctive wide avenues, beautifully restored stone houses, and a relaxed village-like atmosphere that feels surprisingly peaceful given how central it is. Emek Refaim Street is lined with excellent cafes, bakeries, and restaurants popular with Jerusalem's Anglo community. The converted Ottoman-era railway park runs through the neighbourhood - one of the finest Shabbos afternoon walks in the city. Well served by public transport and close to both the city centre and the southern neighbourhoods.`

const cityCenterDsc = `The heart of modern Jerusalem, offering unmatched walkability and immediate access to everything the city has to offer. Ben Yehuda Street and the pedestrian mall, Mahane Yehuda Market, the light rail, and the Old City are all within comfortable reach on foot. The neighbourhood is lively, diverse, and constantly in motion - best suited to guests who want to be in the middle of things, whether for business, tourism, or exploring the city's restaurants and nightlife. Not the quietest option but unquestionably the most central.`

const nachlaotDsc = `One of Jerusalem's most beloved and characterful neighbourhoods - a maze of narrow stone alleyways, hidden courtyards, and beautifully restored low-rise buildings that feel untouched by the modern city surrounding them. It sits directly adjacent to Mahane Yehuda Market, meaning the best food in Jerusalem is a two-minute walk from your front door. The neighbourhood has a vibrant, eclectic atmosphere with a mix of long-established families, young Israelis, and international residents. Ideal for food lovers, creatives, and guests who want an authentic, characterful stay with real local flavour.`

const mamillaDsc = `A premium district sitting directly alongside the Jaffa Gate and the walls of the Old City, with the Mamilla Mall and its boutiques and restaurants at street level. Accommodation here is at the upper end of the market, offering modern finishes, security, and immediate access to the Old City on foot. For guests who want luxury and location in equal measure - and the ability to walk to the Kotel in under ten minutes - Mamilla is unmatched.`

const oldCityDsc = `Staying inside the walls of the Old City is an experience unlike anywhere else. The Jewish Quarter offers a small selection of carefully restored apartments within walking distance of the Kotel, the great synagogues of Jerusalem, and the markets and streets that have defined Jewish life in this city for centuries. On Shabbos and Yom Tov the Quarter comes alive in a way that is genuinely unique - the sounds of davening through open windows, families filling the alleyways, a connection to something ancient and continuous. Not the most convenient neighbourhood for everyday amenities, but for guests visiting for Yom Tov, a simcha, or a once-in-a-lifetime Jerusalem experience it is incomparable.`

const katamonDsc = `A large, well-established neighbourhood in the heart of West Jerusalem, known for its strong Anglo-Jewish community, excellent quality of life, and concentration of shuls catering to English-speaking communities. The neighbourhood has good local shopping, parks, and a genuinely residential character that makes it particularly popular for longer stays and family visits. It borders the German Colony to the north and Baka to the east, making both easily accessible on foot. Shabbos in Katamon has a distinctive warmth - streets full of families, a real community atmosphere, and the kind of welcome that makes guests feel at home immediately.`

const bakaDsc = `One of Jerusalem's most appealing neighbourhoods for short-term visitors - beautifully restored stone houses, a relaxed and unpretentious atmosphere, and a strong sense of neighbourhood life. The area has excellent cafes, independent restaurants, and local shops along its main streets, alongside a growing Anglo-Jewish community and several shuls within easy walking distance. More affordable than neighbouring Katamon and the German Colony, yet with a distinctive character all its own. Particularly popular with younger families and guests on extended visits who want to settle into a real community rather than a tourist zone.`

const harNofDsc = `Set on the western hills of Jerusalem with commanding views across the valley, Har Nof is a predominantly chareidi neighbourhood with a strong, established community feel and a noticeably quieter pace of life than more central areas. The streets are spacious, the apartments tend to be larger than average, and the neighbourhood has a full range of community infrastructure including multiple shuls, kosher shops, and schools. For frum families seeking a genuinely observant environment with fresh air, space, and a peaceful Shabbos atmosphere, Har Nof is an excellent choice.`

const givatShaulDsc = `Sits at the western entrance to Jerusalem, close to the central bus station and major transport routes, making it one of the most accessible neighbourhoods in the city. It has a predominantly chareidi character with multiple shuls, local shops, and the kind of unpretentious community life that defines traditional Jerusalem. Convenient for guests arriving from Ben Gurion or needing easy access to Tel Aviv, and well-priced relative to more central neighbourhoods.`

const ramatEshkolDsc = `Ramat Eshkol and neighbouring Ma'alot Dafna have become two of the most popular destinations in Jerusalem for Anglo-Jewish families. Strong community infrastructure, multiple shuls of different communities, proximity to leading yeshivos and seminaries, and a wide range of apartments make these neighbourhoods a natural base for families visiting children who are learning in the city, as well as for longer-stay guests who want to feel part of a real kehilla. The neighbourhoods have a warm, established Anglo feel and the kind of local knowledge and community support that makes navigating Jerusalem considerably easier.`

const maalotDafnaDsc = `Neighbouring Ramat Eshkol, Ma'alot Dafna shares the same warm Anglo-Jewish community character and has become one of the most sought-after addresses in Jerusalem for frum families from abroad. Well-served by shuls, schools, and local shops, it offers a strong sense of kehilla life alongside the practical conveniences of a well-developed residential neighbourhood. Proximity to leading yeshivos and seminaries makes it a natural choice for families visiting children learning in the city.`

const geulaDsc = `One of the most vibrant and energetic neighbourhoods in chareidi Jerusalem. Malchei Yisrael Street - known as the ultra-Orthodox Oxford Street - buzzes with life every day of the week and reaches an extraordinary intensity on erev Shabbos and erev Yom Tov. The neighbourhood is home to Chassidic courts, kollelim, and botei medrash of every kind. Best suited to guests who are fully comfortable in a chareidi environment and who want an immersive, authentic experience of traditional Jewish life in Yerushalayim.`

const meaShearimDsc = `One of the oldest and most historically significant Jewish neighbourhoods outside the Old City walls, Mea Shearim is a world unto itself - deeply traditional, intensely communal, and entirely governed by the rhythms of halacha and the Jewish calendar. The neighbourhood is home to some of the oldest Chassidic and Yerushalmi communities in the world. Guests staying here should be aware that modest dress is expected at all times in public, and that the neighbourhood's character and sensitivities should be respected throughout their stay.`

const romemaDsc = `A well-established chareidi neighbourhood at the entrance to Jerusalem with a strong Chassidish character and good community infrastructure. Romema has undergone significant development in recent years and now offers a range of quality apartments alongside its traditional character. Close to several major mosdos and convenient for access to the rest of the city, it appeals to frum families who want a fully observant environment with the warmth and community feel that Romema has always been known for.`

const ramotDsc = `A large, modern neighbourhood in northern Jerusalem, popular with chareidi and Dati Leumi families and home to a substantial Anglo-Jewish community. Full range of community infrastructure - numerous shuls, kosher supermarkets, restaurants, and schools. Offers very good value for money compared to more central neighbourhoods while maintaining easy access to the rest of the city. Particularly suited to frum families visiting for Yom Tov, when the neighbourhood comes alive with the sounds and rhythms of chag.`

const talpiotDsc = `Two neighbourhoods in one: quiet garden-suburb streets of secular, traditional and religious families, wrapped around the commercial district where much of southern Jerusalem comes to shop and eat. Central and practical, just south of Baka and the German Colony.`

const arnonaDsc = `The calmest, best-value corner of the southern Anglo belt — quieter than Baka or the German Colony just north, popular with Anglo and Dati Leumi families, with the desert-edge promenade nearby.`

const beitHakeremDsc = `A leafy, largely secular garden neighbourhood on the west side, known for its schools and its easy light-rail ride to the centre. Residential and calm, well clear of the tourist crowds.`

const frenchHillDsc = `Jerusalem's most mixed neighbourhood — secular, religious, Anglo and a large student crowd — up north beside the Hebrew University's Mount Scopus campus, at student-friendly prices.`

const kiryatYovelDsc = `A large, affordable neighbourhood in the south-west with a young, creative, mixed crowd and plenty of green space — right next to the Malha mall and parks.`

const givatMordechaiDsc = `A quiet, mixed-religious pocket beside Bayit Vegan and the main roads in and out of the city — convenient and well-priced, without the bustle.`

const abuTorDsc = `A hillside on the seam just below the Old City walls, mixed Jewish and Arab, with some of the finest Old City views in Jerusalem and an almost-village calm.`

const bayitVeganDsc = `A hilltop chareidi neighbourhood, strongly Litvish and Anglo and dense with yeshivos and seminaries — the natural base for parents visiting children learning in Jerusalem. Larger apartments and fresh air.`

const sanhedriaDsc = `An established chareidi neighbourhood built around the ancient Tombs of the Sanhedrin — a calmer, more residential alternative to Geula and Mea Shearim just to its south.`

const ramatShlomoDsc = `The newest and most spacious of the chareidi neighbourhoods, up north — wide streets and larger, modern apartments that suit big families and Yom Tov groups, at good value.`

const ezrasTorahDsc = `A small, intensely Litvish learning enclave a short walk from Geula — quiet and tightly knit, for guests at home in a fully chareidi setting.`

const mattersdorfDsc = `The chareidi neighbourhood with the strongest Anglo presence — the natural landing spot for English-speaking frum families, orderly and walkable, just up from Geula.`

const kiryatMosheDsc = `A mixed religious neighbourhood at the western gateway to the city, home to a landmark religious-Zionist yeshiva — hard to beat for getting in and out of Jerusalem.`

const sorotzkinDsc = `A quiet, solidly chareidi residential pocket near Mattersdorf and Tel Arza — a step back from the busiest streets, yet close to everything the surrounding neighbourhoods offer.`

const keremAvrahamDsc = `One of Jerusalem's older quarters, now chareidi and right on Geula's doorstep — historic streets, real community, and better value than the centre.`

const einKeremDsc = `A picturesque stone village in the wooded hills on the city's south-western edge — springs, galleries and hillside restaurants. The most scenic, get-away-from-it-all corner of Jerusalem.`

const malhaDsc = `Jerusalem's amenities hub in the south-west, built around the big mall, the stadium, the zoo and a train station — easy parking and family attractions, a short ride from the centre.`

const armonHanatzivDsc = `Home to Jerusalem's finest promenade and its sweeping Old City panorama — a quiet, mixed ridge neighbourhood with big views and better value than the centre.`

const giloDsc = `A large hillside neighbourhood on the southern edge, with wide valley views, parks and family-sized apartments — space and value over location.`

const neveYaakovDsc = `The far-northern end of the city and one of its best-value bases — strikingly diverse, well served, and sitting at the end of the light-rail line.`

const pisgatZeevDsc = `One of Jerusalem's largest neighbourhoods — a suburban, family-first north with malls, parks and the light rail running through it. Space and value, a ride from the centre.`

export const neighborhoodDescriptions: Record<string, string> = {
  'Yemin Moshe': yeminMosheDsc,
  Talbiya: talbiyaDsc,
  Talbieh: talbiyaDsc,
  'Sharei Chessed': shareiChessedDsc,
  'Shaarei Chesed': shareiChessedDsc,
  "Sha'arei Hesed": shareiChessedDsc,
  Rechavia: rechaviaDsc,
  'German Colony': germanColonyDsc,
  'City Center': cityCenterDsc,
  'City Centre': cityCenterDsc,
  Nachlaot: nachlaotDsc,
  Mamilla: mamillaDsc,
  'Old City': oldCityDsc,
  'Jewish Quarter': oldCityDsc,
  Katamon: katamonDsc,
  Baka: bakaDsc,
  "Baka'a": bakaDsc,
  'Har Nof': harNofDsc,
  'Givat Shaul': givatShaulDsc,
  'Ramat Eshkol': ramatEshkolDsc,
  'Maalot Dafna': maalotDafnaDsc,
  "Ma'alot Dafna": maalotDafnaDsc,
  Geula: geulaDsc,
  "Ge'ula": geulaDsc,
  'Mea Shearim': meaShearimDsc,
  'Meah Shearim': meaShearimDsc,
  Romema: romemaDsc,
  Ramot: ramotDsc,
  Talpiot: talpiotDsc,
  Talpiyot: talpiotDsc,
  Talpioth: talpiotDsc,
  Arnona: arnonaDsc,
  'Beit Hakerem': beitHakeremDsc,
  'Beit HaKerem': beitHakeremDsc,
  'Bet Hakerem': beitHakeremDsc,
  'French Hill': frenchHillDsc,
  'Givat Shapira': frenchHillDsc,
  'Kiryat Yovel': kiryatYovelDsc,
  'Kiryat HaYovel': kiryatYovelDsc,
  'Kiryat Hayovel': kiryatYovelDsc,
  'Givat Mordechai': givatMordechaiDsc,
  'Givat Mordekhai': givatMordechaiDsc,
  'Abu Tor': abuTorDsc,
  'Abu-Tor': abuTorDsc,
  'Bayit Vegan': bayitVeganDsc,
  'Bayis Vagan': bayitVeganDsc,
  'Bayit VeGan': bayitVeganDsc,
  Sanhedria: sanhedriaDsc,
  Sanhedriah: sanhedriaDsc,
  Sanhedriya: sanhedriaDsc,
  'Ramat Shlomo': ramatShlomoDsc,
  'Ezras Torah': ezrasTorahDsc,
  'Ezrat Torah': ezrasTorahDsc,
  Mattersdorf: mattersdorfDsc,
  Matersdorf: mattersdorfDsc,
  'Kiryat Mattersdorf': mattersdorfDsc,
  'Kiryat Moshe': kiryatMosheDsc,
  Sorotzkin: sorotzkinDsc,
  Sorotskin: sorotzkinDsc,
  'Kerem Avraham': keremAvrahamDsc,
  'Kerem Avrohom': keremAvrahamDsc,
  'Ein Kerem': einKeremDsc,
  'Ein Karem': einKeremDsc,
  'Ain Karem': einKeremDsc,
  Malha: malhaDsc,
  Malcha: malhaDsc,
  Manachat: malhaDsc,
  'Armon Hanatziv': armonHanatzivDsc,
  'Armon HaNetziv': armonHanatzivDsc,
  'East Talpiot': armonHanatzivDsc,
  'Talpiot Mizrach': armonHanatzivDsc,
  Gilo: giloDsc,
  'Neve Yaakov': neveYaakovDsc,
  'Neve Yaacov': neveYaakovDsc,
  'Neveh Yaakov': neveYaakovDsc,
  'Pisgat Zeev': pisgatZeevDsc,
  "Pisgat Ze'ev": pisgatZeevDsc,
  'Pisgat Zev': pisgatZeevDsc,
}
