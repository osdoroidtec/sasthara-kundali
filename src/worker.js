import { Constants, load } from "@fusionstrings/swiss-eph";
const ephPromise = load();

const SIGNS = [
  "මේෂ", "වෘෂභ", "මිථුන", "කටක", "සිංහ", "කන්‍යා",
  "තුලා", "වෘශ්චික", "ධනු", "මකර", "කුම්භ", "මීන"
];

const NAKSHATRAS = [
  "අශ්විනී", "භරණී", "කෘත්තිකා", "රෝහිණී", "මෘගශීර්ෂ",
  "ආද්‍රා", "පුනර්වසූ", "පුෂ්‍ය", "අශ්ලේෂා", "මඝා",
  "පූර්වඵල්ගුණී", "උත්තරඵල්ගුණී", "හස්ත", "චිත්‍රා",
  "ස්වාති", "විශාඛා", "අනුරාධා", "ජ්‍යේෂ්ඨා", "මූල",
  "පූර්වාෂාඪා", "උත්තරාෂාඪා", "ශ්‍රවණ", "ධනිෂ්ඨා",
  "ශතභිෂා", "පූර්වභාද්‍රපදා", "උත්තරභාද්‍රපදා", "රේවතී"
];

const PLANETS = [
  ["Sun", Constants.SE_SUN, "☉"],
  ["Moon", Constants.SE_MOON, "☽"],
  ["Mars", Constants.SE_MARS, "♂"],
  ["Mercury", Constants.SE_MERCURY, "☿"],
  ["Jupiter", Constants.SE_JUPITER, "♃"],
  ["Venus", Constants.SE_VENUS, "♀"],
  ["Saturn", Constants.SE_SATURN, "♄"],
  ["Rahu", Constants.SE_MEAN_NODE, "☊"]
];

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders()
    }
  });
}

function signIndex(longitude) {
  return Math.floor((((longitude % 360) + 360) % 360) / 30);
}

function degreeText(longitude) {
  let x = ((longitude % 360) + 360) % 360;
  let d = x % 30;
  const deg = Math.floor(d);
  const min = Math.floor((d - deg) * 60);
  const sec = Math.round((((d - deg) * 60) - min) * 60);

  return `${deg}° ${String(min).padStart(2, "0")}' ${String(sec).padStart(2, "0")}"`;
}

function nakshatra(longitude) {
  const normalized = ((longitude % 360) + 360) % 360;
  const span = 360 / 27;
  const index = Math.floor(normalized / span);
  const inside = normalized - index * span;
  const pada = Math.min(4, Math.floor(inside / (span / 4)) + 1);

  return {
    name: NAKSHATRAS[index],
    pada
  };
}

function parseLocalDateTime(date, time, timezoneOffset) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);

  if (!y || !m || !d || hh === undefined || mm === undefined) {
    throw new Error("දිනය හෝ වේලාව වැරදියි.");
  }

  // Convert local time to UTC.
  const utcMillis = Date.UTC(y, m - 1, d, hh, mm) -
    Number(timezoneOffset || 5.5) * 60 * 60 * 1000;

  const utc = new Date(utcMillis);

  const hour =
    utc.getUTCHours() +
    utc.getUTCMinutes() / 60 +
    utc.getUTCSeconds() / 3600;

  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
    hour
  };
}

async function geocode(place) {
  const url =
    "https://nominatim.openstreetmap.org/search" +
    "?format=json&limit=1&q=" +
    encodeURIComponent(place);

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Sasthara-Kundali/1.0"
    }
  });

  if (!response.ok) {
    throw new Error("උපන් ස්ථානය සොයාගැනීමට නොහැකි විය.");
  }

  const data = await response.json();

  if (!data.length) {
    throw new Error("උපන් ස්ථානය හමු නොවීය.");
  }

  return {
    latitude: Number(data[0].lat),
    longitude: Number(data[0].lon),
    displayName: data[0].display_name
  };
}

async function calculate(body) {
  const eph = await ephPromise;

  const place = await geocode(body.birth_place);

  const utc = parseLocalDateTime(
    body.birth_date,
    body.birth_time,
    body.timezone_offset
  );

  const jd = eph.swe_julday(
    utc.year,
    utc.month,
    utc.day,
    utc.hour,
    Constants.SE_GREG_CAL
  );

  // Lahiri ayanamsha + sidereal calculations.
  eph.swe_set_sid_mode(
    Constants.SE_SIDM_LAHIRI,
    0,
    0
  );

  const flags =
    Constants.SEFLG_SWIEPH |
    Constants.SEFLG_SPEED |
    Constants.SEFLG_SIDEREAL;

  const planets = [];

  for (const [name, id, symbol] of PLANETS) {
    const result = eph.swe_calc_ut(jd, id, flags);

    if (result.returnCode < 0) {
      throw new Error(`${name} calculation failed: ${result.error}`);
    }

    const longitude = ((result.xx[0] % 360) + 360) % 360;

    planets.push({
      name,
      symbol,
      longitude,
      sign: SIGNS[signIndex(longitude)],
      degree: degreeText(longitude),
      retrograde: result.xx[3] < 0
    });
  }

  // Ketu is opposite Rahu.
  const rahu = planets.find(p => p.name === "Rahu");
  const ketuLongitude = (rahu.longitude + 180) % 360;

  planets.push({
    name: "Ketu",
    symbol: "☋",
    longitude: ketuLongitude,
    sign: SIGNS[signIndex(ketuLongitude)],
    degree: degreeText(ketuLongitude),
    retrograde: true
  });

   // Sidereal houses / ascendant.
  const houses = eph.swe_houses(
    jd,
    place.latitude,
    place.longitude,
    "P".charCodeAt(0)
  );

  const ascendant =
    ((houses.ascmc[0] % 360) + 360) % 360;
  const moon = planets.find(p => p.name === "Moon");
  const moonNakshatra = nakshatra(moon.longitude);

  const houseList = [];

  for (let i = 0; i < 12; i++) {
    const cusp =
      ((houses.cusps[i] % 360) + 360) % 360;

    houseList.push({
      house: i + 1,
      longitude: cusp,
      sign: SIGNS[signIndex(cusp)]
    });
  }

  return {
    success: true,

    name: body.name || "ඔබ",

    birth: {
      date: body.birth_date,
      time: body.birth_time,
      place: place.displayName,
      latitude: place.latitude,
      longitude: place.longitude,
      timezoneOffset: Number(body.timezone_offset || 5.5)
    },

    system: {
      zodiac: "Sidereal / Vedic",
      ayanamsha: "Lahiri",
      houseSystem: "Placidus"
    },

    lagna: {
      longitude: ascendant,
      sign: SIGNS[signIndex(ascendant)],
      degree: degreeText(ascendant)
    },

    moon: {
      sign: moon.sign,
      degree: moon.degree,
      nakshatra: moonNakshatra.name,
      pada: moonNakshatra.pada
    },

    planets,

    houses: houseList
  };
}

export default {
  async fetch(request) {

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders()
      });
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return json({
        ok: true,
        service: "Sasthara Janma Kundali API",
        version: "1.0"
      });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        status: "healthy"
      });
    }

    if (
      request.method === "POST" &&
      url.pathname === "/api/kundali"
    ) {
      try {
        const body = await request.json();

        if (
          !body.birth_date ||
          !body.birth_time ||
          !body.birth_place
        ) {
          return json({
            success: false,
            error: "උපන් දිනය, වේලාව සහ ස්ථානය අවශ්‍යයි."
          }, 400);
        }

        const result = await calculate(body);

        return json(result);

      } catch (error) {
        return json({
          success: false,
          error: error.message || "Calculation failed."
        }, 500);
      }
    }

    return json({
      success: false,
      error: "Not found"
    }, 404);
  }
};
