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

const talpiotDsc = `Just south of Baka and the German Colony, Talpiot brings together two very different characters. Its residential streets, first laid out as a garden suburb in the 1920s, are calm, leafy, and green, home to a mixed population of secular, traditional, and religious families. Alongside sits a busy commercial district known across the city for its showrooms, shopping, cafes, and restaurants, where much of southern Jerusalem comes to shop and eat. Well connected to the rest of the city and within reach of the southern neighbourhoods on foot, it suits guests who want everyday convenience alongside a genuinely local, unpolished Jerusalem feel.`

const arnonaDsc = `A quiet, leafy residential neighbourhood in southern Jerusalem, Arnona sits just beyond Talpiot and within easy reach of Baka and the German Colony. Its calm, tree-lined streets and unhurried pace have made it a favourite among Anglo and Dati Leumi families, alongside a mix of secular and traditional residents. The atmosphere is genuinely residential rather than touristy - a place to settle in, with local shops and everyday amenities close at hand and a promenade overlooking the desert within reach to the east. Generally better value than the neighbourhoods to its north, it suits families and longer-stay guests who want peace, space, and a real sense of community.`

const beitHakeremDsc = `One of West Jerusalem's original garden neighbourhoods, Beit Hakerem was established in the 1920s and still feels green, orderly, and quietly established. Leafy streets, a central square with local cafes, and a strong reputation for schools give it an appealing, family-first character, with a largely secular and traditional population and a genuinely mixed, unpretentious feel. It sits in the city's west, close to Mount Herzl and connected to the centre by light rail, so getting around is straightforward without being in the thick of the tourist crowds. Ideal for families and longer-stay guests who want a calm, authentically local neighbourhood with easy transport across Jerusalem.`

const frenchHillDsc = `Set on high ground in northern Jerusalem, French Hill is one of the city's most diverse neighbourhoods, home to a mix of secular Israelis, religious families, Anglos, and a large student population drawn by its closeness to the Hebrew University's Mount Scopus campus. The atmosphere is practical and unpretentious, with a local shopping centre, cafes, and everyday amenities serving a busy, varied community. Well connected to the centre by light rail, it offers good value and easy access rather than tourist polish. It suits students, visiting academics, and families who want an affordable, genuinely mixed neighbourhood with strong transport links and a real cross-section of Jerusalem life on the doorstep.`

const kiryatYovelDsc = `A large, diverse neighbourhood in south-western Jerusalem, Kiryat Yovel has a lively, down-to-earth character shaped by generations of families from every background. Today it draws a growing number of young families, students, and creatives attracted by its relative affordability and easy-going, mixed atmosphere. Green spaces and playgrounds are dotted throughout, and the Malha shopping and leisure district, with its mall and parks, lies close by to the south. Well connected to the rest of the city and offering noticeably better value than the central neighbourhoods, it is ideal for guests who want an authentic, unvarnished slice of everyday Jerusalem with space, greenery, and good value over polish.`

const givatMordechaiDsc = `A quiet, settled residential neighbourhood in south-central Jerusalem, Givat Mordechai sits close to Bayit Vegan and the main routes into and out of the city, making it a convenient base for reaching the rest of Jerusalem. Its character is largely religious, with a comfortable mix of Dati Leumi and chareidi families alongside longer-established residents, and the pace is calm and community-oriented rather than central or bustling. Local shops, shuls, and everyday amenities serve the neighbourhood, and apartments here tend to offer good value compared with the more sought-after central areas. It suits observant families and longer-stay guests who want a peaceful, genuinely residential setting with straightforward access across the city.`

const abuTorDsc = `Draped over a hillside just south of the Old City walls, Abu Tor is one of Jerusalem's genuinely mixed Jewish and Arab neighbourhoods, prized above all for its extraordinary views across the Old City and the valleys below. Its older stone houses, winding lanes, and leafy corners give it a quiet, characterful, almost village-like feel, and the western, largely Jewish side is calm and residential. The location is remarkable - close to the German Colony and the southern neighbourhoods on one side and a short distance from the Old City on the other. It suits guests drawn to views, history, and atmosphere who want a peaceful, distinctive base within easy reach of the centre.`

const bayitVeganDsc = `Set on a high ridge in south-western Jerusalem, Bayit Vegan is a long-established, predominantly chareidi neighbourhood with a strong Litvish and Anglo presence and a notably calm, residential pace. It sits above the city with fresh air and open views, and is home to a dense concentration of yeshivos, seminaries, and communal institutions that draw families visiting children learning in Jerusalem. The streets are quiet and green, apartments tend to run larger than in the centre, and everyday kosher shops and shuls are close at hand. Ideal for frum families and longer-stay guests who want a genuinely observant environment, space, and a peaceful Shabbos away from the bustle of the centre.`

const sanhedriaDsc = `Named for the ancient Tombs of the Sanhedrin at its heart, Sanhedria is an established chareidi neighbourhood in north-central Jerusalem, within easy reach of Geula, Mea Shearim, and the Ramat Eshkol area. It has a settled, family-oriented character with a mix of Chassidish and Litvish communities, plenty of shuls and kollelim, and the everyday kosher shops that make a longer stay straightforward. The atmosphere is traditional and unhurried, quieter than the neighbourhoods immediately to its south yet still well connected to the rest of the city. A comfortable choice for frum families and guests who want an authentically chareidi setting with good community infrastructure close at hand.`

const ramatShlomoDsc = `A large, modern chareidi neighbourhood in northern Jerusalem, Ramat Shlomo was built for family life and shows it: wide streets, newer apartment blocks that tend to be more spacious than the older centre, and a full range of community infrastructure including shuls, kosher supermarkets, and schools. The community is predominantly chareidi, with both Chassidish and Litvish families, and the pace is settled and residential. It offers good value relative to more central neighbourhoods while remaining well connected to Geula, Sanhedria, and the rest of the city. Particularly suited to frum families and larger groups visiting for Yom Tov or an extended stay who want space and a fully observant environment.`

const ezrasTorahDsc = `A small, tightly knit chareidi enclave in north-central Jerusalem, Ezras Torah sits close to Geula, Kerem Avraham, and the Ramat Eshkol area, giving it a quiet residential feel within easy reach of the busier chareidi centres. Founded as a planned community for Torah scholars, it retains a strongly Litvish, learning-oriented character, with shuls, kollelim, and modest local shops woven through its streets. The atmosphere is calm and unassuming, the community established and welcoming. Best suited to frum families and guests comfortable in a fully chareidi environment who prize a peaceful, genuinely local base over central bustle, while staying within a short walk of Geula's amenities.`

const mattersdorfDsc = `Set in north-central Jerusalem near Sanhedria and the Shmuel HaNavi area, Mattersdorf is a well-established chareidi neighbourhood with a notably strong Anglo and Litvish presence, making it a natural base for English-speaking families. Named after the European community that founded it, it has a settled, orderly character, with shuls, kollelim, kosher shops, and seminaries close at hand. The pace is residential and community-minded, quieter than Geula yet only a short distance from it and well connected to the rest of the city. Ideal for frum families visiting children learning in Jerusalem and for longer-stay guests who want a warm, observant kehilla with everything within walking distance.`

const kiryatMosheDsc = `Near the western entrance to Jerusalem, Kiryat Moshe sits close to Givat Shaul and the city's main transport routes, making it one of the more accessible neighbourhoods around. Its character is mixed and religious: home to a well-known religious-Zionist yeshiva alongside chareidi and Dati Leumi families, giving it a warm, observant feel that spans communities. The neighbourhood has shuls, local kosher shops, and the everyday conveniences of an established residential area, with the light rail and city centre within easy reach. A practical, well-connected choice for religious families and guests who want easy access to both the centre and the routes in and out of the city.`

const sorotzkinDsc = `Centred on one of chareidi Jerusalem's well-known residential streets, the Sorotzkin area sits in the north-central part of the city near Mattersdorf, Tel Arza, and the wider Geula orbit. It is a solidly chareidi micro-area with a mix of Chassidish and Litvish families, lined with apartment buildings, shuls, and small kosher shops that serve daily life. The atmosphere is traditional, settled, and residential, a step removed from the busiest chareidi thoroughfares yet within easy reach of them. A comfortable option for frum guests and families who want to stay within an established, fully observant community while remaining close to the amenities of the surrounding chareidi neighbourhoods.`

const keremAvrahamDsc = `An older, well-established neighbourhood just north of the city centre, Kerem Avraham has become a predominantly chareidi area while retaining the character of one of Jerusalem's historic quarters. It borders Geula and the Zichron Moshe area, placing the heart of chareidi Jerusalem within easy walking distance, and its streets carry a settled, lived-in feel, with shuls, kollelim, and everyday kosher shops throughout. The community is largely chareidi, with a mix of Chassidish and Litvish families. Well priced relative to more central options and genuinely convenient, it suits frum families and longer-stay guests who want an authentic, observant neighbourhood close to both the chareidi centre and the wider city.`

const einKeremDsc = `Tucked into the wooded hills on the south-western edge of Jerusalem, Ein Kerem feels a world away from the city while remaining within its boundaries. This historic village of stone houses, terraced gardens, church spires, and a natural spring is one of the most scenic corners of Jerusalem - long beloved by artists and drawing visitors of many faiths for its pilgrimage significance. Its winding lanes hold galleries, boutique guesthouses, and some of the city's prettiest restaurants and cafes, and a major medical centre sits on the ridge above. Ideal for couples, nature lovers, and guests seeking a tranquil, picturesque retreat rather than a central base.`

const malhaDsc = `Malha sits in the south-western corner of Jerusalem, a modern, well-serviced quarter built around some of the city's largest leisure and shopping destinations. One of Jerusalem's biggest shopping malls, a major stadium, the biblical zoo, and a mainline train station are clustered here, making it especially convenient for families who value amenities, parking, and easy comings and goings. The residential streets on the surrounding slopes are calm and green, a little removed from the tourist centre but well connected to it. It suits guests who want space, practicality, and family-friendly attractions close by rather than the bustle of downtown, and who don't mind a short ride into the historic core.`

const armonHanatzivDsc = `Perched on a ridge in southern Jerusalem, Armon Hanatziv is best known for its sweeping promenade, where one of the finest panoramas of the Old City and the surrounding hills opens up at your feet. The neighbourhood is largely residential and pleasantly quiet, with a mixed population and a settled, unfussy character. Apartments here tend to offer good value and generous space compared with the central neighbourhoods, and the views from the higher streets are hard to match anywhere in the city. Local shops and parks serve everyday needs, while the centre and the Old City are a manageable ride away. A practical, scenic choice for families and budget-conscious travellers who prize the outlook and the calm.`

const giloDsc = `Gilo spreads across the hills at the southern edge of Jerusalem, one of the city's large residential neighbourhoods, home to a mixed community of secular, traditional, and Dati Leumi families. It is very much a place people live rather than visit - leafy streets, local shopping centres, parks, schools, and wide views over the surrounding valleys. The atmosphere is calm and family-oriented, and apartments generally offer strong value and more room than you would find closer to the centre. It sits a little apart from the tourist core but is well connected by road and public transport. A sensible base for families and longer-stay guests who want an authentic residential neighbourhood, space, and a quieter pace.`

const neveYaakovDsc = `Neve Yaakov lies at the far northern end of Jerusalem, one of the city's outlying residential neighbourhoods and a good-value base well away from the tourist centre. It is home to a diverse community - chareidi, Dati Leumi, Russian-speaking, and Anglo families among them - with the full complement of shuls, kosher shopping, schools, and local services that make daily life straightforward. The neighbourhood sits near the northern reach of the light rail, giving reasonable access to the rest of the city despite the distance. Streets are quiet and residential, and apartments tend to be spacious and affordable. Best suited to guests who prioritise value, community, and space over proximity to the historic sights.`

const pisgatZeevDsc = `Pisgat Zeev is one of Jerusalem's largest neighbourhoods, spread across the hills in the north of the city and built very much with families in mind. Its population is broadly mixed - secular, traditional, and religious residents live side by side - and the neighbourhood is well equipped with shopping centres, parks, playgrounds, schools, and everyday services. The light rail runs through it, giving straightforward access toward the centre despite the distance from the historic core. The mood is suburban, calm, and child-friendly, and apartments offer generous space and good value. A comfortable, practical choice for families and longer-stay guests who want room to spread out and a genuine residential setting rather than a central location.`

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
