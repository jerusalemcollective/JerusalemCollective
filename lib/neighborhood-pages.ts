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
  const canonical = allNeighborhoods.find((name) => slugifyNeighborhood(name) === slug)
  if (canonical) return canonical

  // Alternate spellings (e.g. "Sharei Chessed") resolve to the canonical
  // neighbourhood that shares the same description, so older links keep working.
  const alias = Object.keys(neighborhoodDescriptions).find((name) => slugifyNeighborhood(name) === slug)
  if (!alias) return null
  const description = neighborhoodDescriptions[alias]
  return (
    allNeighborhoods.find((name) => neighborhoodDescriptions[name] === description) || alias
  )
}

const yeminMosheDsc = `Yemin Moshe is one of Jerusalem's most special neighbourhoods. Built in the 19th century, it was the first Jewish neighbourhood outside the Old City walls. Stone homes, red-tiled roofs and flower-filled courtyards look straight across at the walls, with some of the best views in the city. It's quiet, small and beautifully kept, and lovely for couples and anyone who wants a stay that feels truly historic. The Montefiore Windmill and the promenade along the valley are just steps away.`

const talbiyaDsc = `Talbiya is one of Jerusalem's most elegant places to live. It was built in the early 20th century, with wide streets, old trees and grand stone villas. It sits next to the President's Residence, and it's an easy walk to the Jerusalem Theatre, Mamilla, the King David Hotel and the Old City. The feel is calm and settled, a real neighbourhood rather than a tourist area. A good fit for families who want somewhere central, quiet and gracious.`

const shareiChessedDsc = `Sha'arei Chessed is a quiet, lovely neighbourhood tucked between Rechavia and Nachlaot. It has elegant stone buildings, neat gardens and a strong, long-standing community. Many well-known Torah scholars have lived here, and its shuls, including the famous Beit Knesset HaGra, are among the best known in Jerusalem. You can walk to the city centre, yet the streets stay peaceful. Families from abroad love it for its calm and for how close it is to everything.`

const rechaviaDsc = `Rechavia is one of Jerusalem's best-loved neighbourhoods, with wide, tree-lined streets and graceful stone buildings that have set its calm tone since the 1920s. The streets are named after medieval Jewish poets and scholars. Sacher Park and Independence Park are a short stroll away, and so are good cafes, the Mahane Yehuda market and Ben Yehuda Street. Several well-known shuls serve the community. A great choice for families and longer stays, and for anyone who wants to feel at home in Jerusalem.`

const germanColonyDsc = `The German Colony is one of the most popular places to stay in Jerusalem. German Templers founded it in the 1870s, and it still has wide avenues, lovingly restored stone houses and a relaxed, village feel that's surprisingly peaceful for somewhere so central. Emek Refaim Street is full of cafes, bakeries and restaurants that are popular with Jerusalem's Anglo community. The old railway line is now a park running through the neighbourhood, and it makes one of the nicest Shabbos afternoon walks in the city. Buses are good, and both the city centre and the southern neighbourhoods are close by.`

const cityCenterDsc = `The city centre is the heart of modern Jerusalem, and you can walk almost everywhere from here. Ben Yehuda Street, Mahane Yehuda market, the light rail and the Old City are all an easy walk away. It's lively, mixed and always busy. Best for guests who want to be in the middle of things, whether for work, sightseeing or eating out. It isn't the quietest area, but it's the most central.`

const nachlaotDsc = `Nachlaot is a maze of narrow stone lanes, hidden courtyards and low, lovingly restored buildings that feel a world away from the city around them. It sits right next to Mahane Yehuda market, so some of the best food in Jerusalem is a two-minute walk from your door. The mix is lively: long-time families, young Israelis and people from abroad. A great fit for food lovers and anyone who wants a stay full of local character.`

const mamillaDsc = `Mamilla sits right beside the Jaffa Gate and the Old City walls, with the Mamilla Mall's shops and restaurants at street level. Places to stay here are at the top end, with modern finishes, security and the Old City on foot. If you want comfort and a great location, with the Kotel less than ten minutes' walk away, Mamilla is hard to beat.`

const oldCityDsc = `Staying inside the Old City walls is like nowhere else. The Jewish Quarter has a small number of carefully restored apartments within walking distance of the Kotel, Jerusalem's great shuls, and the markets and lanes at the centre of Jewish life here for centuries. On Shabbos and Yom Tov the Quarter really comes alive: davening drifts through open windows and families fill the lanes. Day-to-day shopping is less convenient. But for Yom Tov, a simcha or a once-in-a-lifetime trip, there's nothing like it.`

const katamonDsc = `Katamon is a large, settled neighbourhood in West Jerusalem, known for its strong Anglo community, easy everyday life and many shuls for English speakers. There's good local shopping and parks, and a real residential feel that makes it popular for family visits and longer stays. The German Colony and Baka are next door and easy to walk to. Shabbos in Katamon is especially warm, with streets full of families and the kind of welcome that makes you feel at home straight away.`

const bakaDsc = `Baka is one of the nicest neighbourhoods for visitors, with restored stone houses, a relaxed, down-to-earth feel and a real sense of community. Its main streets have good cafes, local restaurants and shops. There's a growing Anglo community and several shuls an easy walk away. It's usually more affordable than Katamon and the German Colony next door, with a character all its own. Popular with younger families and longer stays, for guests who want to settle into a real community.`

const harNofDsc = `Har Nof sits on the western hills of Jerusalem, with wide views across the valley. It's a mainly chareidi neighbourhood with a strong, settled community and a calmer pace than the centre. The streets are spacious and the apartments tend to be bigger than average. You'll find everything you need nearby, including plenty of shuls, kosher shops and schools. For frum families who want a fully observant setting, fresh air, space and a peaceful Shabbos, Har Nof is a great choice.`

const givatShaulDsc = `Givat Shaul is at the western entrance to Jerusalem, close to the central bus station and the main roads, so it's one of the easiest areas to get in and out of. It's mainly chareidi, with plenty of shuls, local shops and simple, traditional community life. Handy if you're arriving from Ben Gurion or need to get to Tel Aviv, and good value compared with the more central areas.`

const ramatEshkolDsc = `Ramat Eshkol and Ma'alot Dafna next door have become two of the most popular areas for Anglo families. There are many shuls for different communities, leading yeshivos and seminaries close by, and a wide range of apartments. That makes them a natural base for parents visiting children who are learning in the city, and for longer stays where you want to feel part of a real kehilla. The Anglo feel is warm and settled, and people here are happy to help you find your way around.`

const maalotDafnaDsc = `Ma'alot Dafna sits next to Ramat Eshkol and has the same warm Anglo community feel. It's become one of the most popular areas in Jerusalem for frum families from abroad. There are shuls, schools and local shops, a strong kehilla and all the everyday comforts of a well-established neighbourhood. With leading yeshivos and seminaries close by, it's a natural choice for parents visiting children learning in the city.`

const geulaDsc = `Geula is one of the busiest, most lively neighbourhoods in chareidi Jerusalem. Malchei Yisrael Street, sometimes called the Oxford Street of the frum world, is full of life every day and especially busy on erev Shabbos and erev Yom Tov. The neighbourhood is home to Chassidic courts, kollelim and botei medrash of every kind. Best for guests who are fully at home in a chareidi setting and want to be right inside traditional Jewish life in Yerushalayim.`

const meaShearimDsc = `Mea Shearim is one of the oldest Jewish neighbourhoods outside the Old City walls, and a world of its own. It's deeply traditional, close-knit and shaped by halacha and the Jewish calendar. Some of the oldest Chassidic and Yerushalmi communities in the world live here. Please note that modest dress is expected in public at all times, and the neighbourhood's ways should be respected throughout your stay.`

const romemaDsc = `Romema is a long-established chareidi neighbourhood at the entrance to Jerusalem, with a strong Chassidish character and everything a community needs. A lot of building in recent years means there's now a good range of quality apartments alongside its traditional feel. It's close to several major mosdos and easy to get around the city from. A good fit for frum families who want a fully observant setting with the warmth Romema is known for.`

const ramotDsc = `Ramot is a large, modern neighbourhood in northern Jerusalem, popular with chareidi and Dati Leumi families and home to a big Anglo community. It has everything you need: lots of shuls, kosher supermarkets, restaurants and schools. It's very good value compared with the more central areas, and still easy to get around the city from. Especially good for frum families coming for Yom Tov, when the whole neighbourhood is full of the sounds of the chag.`

const talpiotDsc = `Two neighbourhoods in one: quiet, garden-lined streets of secular, traditional and religious families, around a busy shopping area where much of southern Jerusalem comes to shop and eat. Central and practical, just south of Baka and the German Colony.`

const arnonaDsc = `A calm, good-value corner of the southern Anglo area. Quieter than Baka or the German Colony just to the north, and popular with Anglo and Dati Leumi families, with the promenade at the edge of the desert nearby.`

const beitHakeremDsc = `A leafy, mostly secular neighbourhood on the west side, known for its schools and an easy light-rail ride into the centre. Calm and residential, well away from the tourist crowds.`

const frenchHillDsc = `One of Jerusalem's most mixed neighbourhoods, with secular, religious and Anglo families and lots of students. It's up in the north beside the Hebrew University's Mount Scopus campus, at student-friendly prices.`

const kiryatYovelDsc = `A large, affordable neighbourhood in the south-west with a young, creative, mixed crowd and lots of green space. The Malha mall and parks are right next door.`

const givatMordechaiDsc = `A quiet, mixed religious area beside Bayit Vegan and the main roads in and out of the city. Handy and good value, without the bustle.`

const abuTorDsc = `A hillside neighbourhood just below the Old City walls, mixed Jewish and Arab. It has some of the best Old City views in Jerusalem and an almost village-like calm.`

const bayitVeganDsc = `A hilltop chareidi neighbourhood, strongly Litvish and Anglo, and full of yeshivos and seminaries. A natural base for parents visiting children learning in Jerusalem, with bigger apartments and fresh air.`

const sanhedriaDsc = `A long-established chareidi neighbourhood built around the ancient Tombs of the Sanhedrin. Calmer and more residential than Geula and Mea Shearim, just to the south.`

const ramatShlomoDsc = `The newest and roomiest of the chareidi neighbourhoods, up in the north. Wide streets and bigger, modern apartments suit large families and Yom Tov groups, at good value.`

const ezrasTorahDsc = `A small, strongly Litvish learning community a short walk from Geula. Quiet and close-knit, for guests at home in a fully chareidi setting.`

const mattersdorfDsc = `The chareidi neighbourhood with the strongest Anglo presence, and a natural first stop for English-speaking frum families. Orderly and easy to walk around, just up from Geula.`

const kiryatMosheDsc = `A mixed religious neighbourhood at the western entrance to the city, home to a well-known religious-Zionist yeshiva. Hard to beat for getting in and out of Jerusalem.`

const sorotzkinDsc = `A quiet, chareidi residential area near Mattersdorf and Tel Arza. A step back from the busiest streets, but close to everything the neighbourhoods around it offer.`

const keremAvrahamDsc = `One of Jerusalem's older areas, now chareidi and right next to Geula. Historic streets, a real community, and better value than the centre.`

const einKeremDsc = `A pretty stone village in the wooded hills on the city's south-western edge, with springs, galleries and hillside restaurants. The most scenic, peaceful corner of Jerusalem.`

const malhaDsc = `The south-west's hub for shops and outings, built around the big mall, the stadium, the zoo and a train station. Easy parking and lots for families to do, a short ride from the centre.`

const armonHanatzivDsc = `Home to Jerusalem's best promenade, with a wide view over the Old City. A quiet, mixed neighbourhood on a ridge, with big views and better value than the centre.`

const giloDsc = `A large hillside neighbourhood on the southern edge, with wide valley views, parks and family-sized apartments. More space and value, a little further out.`

const neveYaakovDsc = `At the far north of the city, and one of the best-value places to stay. Very mixed, with good local services, at the end of the light-rail line.`

const pisgatZeevDsc = `One of Jerusalem's largest neighbourhoods. A suburban, family-friendly area in the north with malls, parks and the light rail running through it. Space and value, a ride from the centre.`

const shmuelHanaviDsc = `A busy chareidi neighbourhood along the light-rail line between Sanhedria and Mea Shearim. Lively, well connected and cheaper than the centre, for guests at home in a fully frum setting.`

const makorBaruchDsc = `An older chareidi area right beside Mahane Yehuda and Geula. Steps from the shuk and the heart of frum Jerusalem, with the feel of a long-established neighbourhood.`

const zichronMosheDsc = `A small, historic chareidi area beside Geula, best known for the shul where there's a minyan almost every hour of the day. Deeply traditional and very central.`

const kiryatBelzDsc = `The centre of Belz Chassidus in the north of the city, built around the huge Belz beis medrash. A fully Chassidic neighbourhood for guests at home in that world.`

const kiryatSanzDsc = `The Sanz-Klausenburg community beside Kiryat Belz. A quiet, close-knit Chassidic neighbourhood in the north, away from the busier chareidi streets.`

const schnellerDsc = `A newer chareidi development on the historic Schneller compound, a short walk from Geula and Makor Baruch. Modern apartments right in the middle of frum Jerusalem.`

const sanhedriaMurchevetDsc = `The newer, higher part above Sanhedria. Wider streets, bigger apartments and a mix of chareidi and Dati Leumi families, at better value than the areas below.`

const mekorChaimDsc = `A small, mixed traditional and religious neighbourhood beside Talpiot in the south. Quiet and residential, and handy for the southern shopping area.`

const irGanimDsc = `A working-class neighbourhood in the south-west, mixed traditional and religious. Some of the best value in the city, and an easy light-rail ride to the centre.`

const patDsc = `A small, well-connected neighbourhood between Talpiot and the south-western hills. Quiet and residential, on the light rail, and much cheaper than the centre.`

export const neighborhoodDescriptions: Record<string, string> = {
  'Yemin Moshe': yeminMosheDsc,
  Talbiya: talbiyaDsc,
  Talbieh: talbiyaDsc,
  'Shaarei Chesed': shareiChessedDsc,
  'Sharei Chessed': shareiChessedDsc,
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
  'Shmuel Hanavi': shmuelHanaviDsc,
  'Shmuel HaNavi': shmuelHanaviDsc,
  'Makor Baruch': makorBaruchDsc,
  'Makor Boruch': makorBaruchDsc,
  'Zichron Moshe': zichronMosheDsc,
  'Kiryat Belz': kiryatBelzDsc,
  'Kiryat Sanz': kiryatSanzDsc,
  'Kiryat Zanz': kiryatSanzDsc,
  Schneller: schnellerDsc,
  'Sanhedria Murchevet': sanhedriaMurchevetDsc,
  'Sanhedria Murchevat': sanhedriaMurchevetDsc,
  'Mekor Chaim': mekorChaimDsc,
  'Mekor Chayim': mekorChaimDsc,
  'Ir Ganim': irGanimDsc,
  'Kiryat Menachem': irGanimDsc,
  Pat: patDsc,
  'Ramot Aleph': ramotDsc,
  'Ramot Bet': ramotDsc,
  'Ramot Gimmel': ramotDsc,
  'Ramot Dalet': ramotDsc,
}
