import { Constants, load } from "@fusionstrings/swisseph-wasi";
const {
  swe_calc_ut,
  swe_julday,
  swe_set_sid_mode,
  swe_get_ayanamsa_ut,
  swe_sidtime,

  SE_GREG_CAL,
  SE_SUN,
  SE_MOON,
  SE_MARS,
  SE_MERCURY,
  SE_JUPITER,
  SE_VENUS,
  SE_SATURN,
  SE_MEAN_NODE,

  SE_SIDM_LAHIRI,

  SEFLG_SWIEPH,
  SEFLG_SPEED,
  SEFLG_SIDEREAL
} = SwissEph;

const SIGNS = [
  "මේෂ",
  "වෘෂභ",
  "මිථුන",
  "කටක",
  "සිංහ",
  "කන්‍යා",
  "තුලා",
  "වෘශ්චික",
  "ධනු",
  "මකර",
  "කුම්භ",
  "මීන"
];

const NAKSHATRAS = [
  "අශ්විනී",
  "භරණී",
  "කෘත්තිකා",
  "රෝහිණී",
  "මෘගශීර්ෂ",
  "ආද්‍රා",
  "පුනර්වසූ",
  "පුෂ්‍ය",
  "අශ්ලේෂා",
  "මඝා",
  "පූර්වඵල්ගුණී",
  "උත්තරඵල්ගුණී",
  "හස්ත",
  "චිත්‍රා",
  "ස්වාති",
  "විශාඛා",
  "අනුරාධා",
  "ජ්‍යේෂ්ඨා",
  "මූල",
  "පූර්වාෂාඪා",
  "උත්තරාෂාඪා",
  "ශ්‍රවණ",
  "ධනිෂ්ඨා",
  "ශතභිෂා",
  "පූර්වභාද්‍රපදා",
  "උත්තරභාද්‍රපදා",
  "රේවතී"
];

const PLANETS = [
  ["Sun", SE_SUN, "☉"],
  ["Moon", SE_MOON, "☽"],
  ["Mars", SE_MARS, "♂"],
  ["Mercury", SE_MERCURY, "☿"],
  ["Jupiter", SE_JUPITER, "♃"],
  ["Venus", SE_VENUS, "♀"],
  ["Saturn", SE_SATURN, "♄"],
  ["Rahu", SE_MEAN_NODE, "☊"]
];

const DASHA_SEQUENCE = [
  ["Ketu", 7],
  ["Venus", 20],
  ["Sun", 6],
  ["Moon", 10],
  ["Mars", 7],
  ["Rahu", 18],
  ["Jupiter", 16],
  ["Saturn", 19],
  ["Mercury", 17]
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

function normalize360(value) {
  return ((Number(value) % 360) + 360) % 360;
}

function signIndex(longitude) {
  return Math.floor(normalize360(longitude) / 30);
}

function degreeText(longitude) {
  const x = normalize360(longitude);
  const d = x % 30;

  const deg = Math.floor(d);
  const minFloat = (d - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = Math.round((minFloat - min) * 60);

  return `${deg}° ${String(min).padStart(2, "0")}' ${String(
    sec
  ).padStart(2, "0")}"`;
}

function nakshatra(longitude) {
  const normalized = normalize360(longitude);

  const span = 360 / 27;

  const index = Math.min(
    26,
    Math.floor(normalized / span)
  );

  const inside = normalized - index * span;

  const pada = Math.min(
    4,
    Math.floor(inside / (span / 4)) + 1
  );

  return {
    index,
    name: NAKSHATRAS[index],
    pada,
    inside,
    span
  };
}

function parseLocalDateTime(
  date,
  time,
  timezoneOffset
) {
  if (
    typeof date !== "string" ||
    typeof time !== "string"
  ) {
    throw new Error(
      "දිනය හෝ වේලාව වැරදියි."
    );
  }

  const dateParts = date
    .split("-")
    .map(Number);

  const timeParts = time
    .split(":")
    .map(Number);

  if (
    dateParts.length !== 3 ||
    timeParts.length < 2
  ) {
    throw new Error(
      "දිනය හෝ වේලාව වැරදියි."
    );
  }

  const [y, m, d] = dateParts;
  const [hh, mm] = timeParts;

  if (
    ![y, m, d, hh, mm].every(
      Number.isFinite
    )
  ) {
    throw new Error(
      "දිනය හෝ වේලාව වැරදියි."
    );
  }

  const offset = Number(
    timezoneOffset ?? 5.5
  );

  if (!Number.isFinite(offset)) {
    throw new Error(
      "Timezone offset වැරදියි."
    );
  }

  const utcMillis =
    Date.UTC(
      y,
      m - 1,
      d,
      hh,
      mm
    ) -
    offset *
      60 *
      60 *
      1000;

  const utc = new Date(utcMillis);

  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
    hour:
      utc.getUTCHours() +
      utc.getUTCMinutes() / 60 +
      utc.getUTCSeconds() / 3600
  };
}

async function geocode(place) {
  if (
    typeof place !== "string" ||
    !place.trim()
  ) {
    throw new Error(
      "උපන් ස්ථානය අවශ්‍යයි."
    );
  }

  const url =
    "https://nominatim.openstreetmap.org/search" +
    "?format=json&limit=1&q=" +
    encodeURIComponent(place.trim());

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Sasthara-Kundali/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(
      "උපන් ස්ථානය සොයාගැනීමට නොහැකි විය."
    );
  }

  const data = await response.json();

  if (
    !Array.isArray(data) ||
    data.length === 0
  ) {
    throw new Error(
      "උපන් ස්ථානය හමු නොවීය."
    );
  }

  const latitude = Number(
    data[0].lat
  );

  const longitude = Number(
    data[0].lon
  );

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    throw new Error(
      "උපන් ස්ථානයේ coordinates වැරදියි."
    );
  }

  return {
    latitude,
    longitude,
    displayName:
      data[0].display_name
  };
}

function getPlanetLongitude(result) {
  if (!result) {
    throw new Error(
      "Swiss Ephemeris returned empty result."
    );
  }

  if (
    typeof result.longitude ===
    "number"
  ) {
    return {
      longitude: result.longitude,
      speed:
        typeof result.speedLongitude ===
        "number"
          ? result.speedLongitude
          : typeof result.speed ===
            "number"
          ? result.speed
          : 0
    };
  }

  if (
    Array.isArray(result) &&
    typeof result[0] === "number"
  ) {
    return {
      longitude: result[0],
      speed:
        typeof result[3] === "number"
          ? result[3]
          : 0
    };
  }

  if (
    result.xx &&
    typeof result.xx[0] ===
      "number"
  ) {
    return {
      longitude: result.xx[0],
      speed:
        typeof result.xx[3] ===
        "number"
          ? result.xx[3]
          : 0
    };
  }

  throw new Error(
    "Swiss Ephemeris result format not recognized."
  );
}

/*
  Tropical ascendant calculation.

  swe_sidtime() gives Greenwich sidereal
  time in hours. We add local longitude,
  calculate tropical ascendant and then
  subtract Lahiri ayanamsha.
*/
function calculateLagna(
  jd,
  latitude,
  longitude,
  ayanamsha
) {
  const gstHours =
    Number(swe_sidtime(jd));

  const lstHours =
    gstHours +
    longitude / 15;

  const theta =
    normalize360(
      lstHours * 15
    ) *
    Math.PI /
    180;

  const latRad =
    Number(latitude) *
    Math.PI /
    180;

  /*
    Mean obliquity of the ecliptic.
    Good astronomical approximation for
    natal chart ascendant calculation.
  */
  const T =
    (jd - 2451545.0) /
    36525;

  const eps =
    (
      23.439291111 -
      0.013004167 * T -
      0.000000164 * T * T +
      0.000000504 * T * T * T
    ) *
    Math.PI /
    180;

  const numerator =
    -Math.cos(theta);

  const denominator =
    Math.sin(theta) *
      Math.cos(eps) +
    Math.tan(latRad) *
      Math.sin(eps);

  let tropicalAsc =
    Math.atan2(
      numerator,
      denominator
    ) *
    180 /
    Math.PI;

  tropicalAsc =
    normalize360(tropicalAsc);

  const siderealAsc =
    normalize360(
      tropicalAsc -
        Number(ayanamsha)
    );

  return {
    tropical: tropicalAsc,
    sidereal: siderealAsc
  };
}

function calculateWholeSignHouses(
  ascendant
) {
  const lagnaSign =
    signIndex(ascendant);

  const houses = [];

  for (let i = 0; i < 12; i++) {
    const sign =
      (lagnaSign + i) % 12;

    houses.push({
      house: i + 1,
      sign: SIGNS[sign],
      signIndex: sign
    });
  }

  return houses;
}

function getHouseFromLongitude(
  longitude,
  ascendant
) {
  const planetSign =
    signIndex(longitude);

  const lagnaSign =
    signIndex(ascendant);

  return (
    ((planetSign -
      lagnaSign +
      12) %
      12) +
    1
  );
}

function calculateVimshottari(
  moonLongitude
) {
  const nk =
    nakshatra(moonLongitude);

  const startingIndex =
    nk.index % 9;

  const firstLord =
    DASHA_SEQUENCE[
      startingIndex
    ];

  const elapsedFraction =
    nk.inside / nk.span;

  const remainingFraction =
    1 - elapsedFraction;

  const firstYears =
    firstLord[1] *
    remainingFraction;

  const sequence = [];

  for (let i = 0; i < 9; i++) {
    const lord =
      DASHA_SEQUENCE[
        (startingIndex + i) % 9
      ];

    const years =
      i === 0
        ? firstYears
        : lord[1];

    sequence.push({
      lord: lord[0],
      years:
        Number(years.toFixed(4))
    });
  }

  return {
    system:
      "Vimshottari Dasha",
    nakshatra:
      nk.name,
    pada:
      nk.pada,
    startingLord:
      firstLord[0],
    balanceYears:
      Number(
        firstYears.toFixed(4)
      ),
    sequence
  };
}

async function calculate(body) {
  if (
    typeof swe_julday !==
      "function" ||
    typeof swe_calc_ut !==
      "function"
  ) {
    throw new Error(
      "Swiss Ephemeris WASM functions are not available."
    );
  }

  const place =
    await geocode(
      body.birth_place
    );

  const utc =
    parseLocalDateTime(
      body.birth_date,
      body.birth_time,
      body.timezone_offset
    );

  const jd =
    swe_julday(
      utc.year,
      utc.month,
      utc.day,
      utc.hour,
      SE_GREG_CAL
    );

  /*
    Lahiri ayanamsha
  */
  swe_set_sid_mode(
    SE_SIDM_LAHIRI,
    0,
    0
  );

  const ayanamsha =
    Number(
      swe_get_ayanamsa_ut(jd)
    );

  const flags =
    SEFLG_SWIEPH |
    SEFLG_SPEED |
    SEFLG_SIDEREAL;

  const planets = [];

  for (
    const [name, id, symbol]
    of PLANETS
  ) {
    const result =
      swe_calc_ut(
        jd,
        id,
        flags
      );

    const calculated =
      getPlanetLongitude(
        result
      );

    const longitude =
      normalize360(
        calculated.longitude
      );

    planets.push({
      name,
      symbol,
      longitude,
      sign:
        SIGNS[
          signIndex(longitude)
        ],
      degree:
        degreeText(longitude),
      house: null,
      retrograde:
        calculated.speed < 0
    });
  }

  const rahu =
    planets.find(
      p => p.name === "Rahu"
    );

  if (rahu) {
    const ketuLongitude =
      normalize360(
        rahu.longitude + 180
      );

    planets.push({
      name: "Ketu",
      symbol: "☋",
      longitude:
        ketuLongitude,
      sign:
        SIGNS[
          signIndex(
            ketuLongitude
          )
        ],
      degree:
        degreeText(
          ketuLongitude
        ),
      house: null,
      retrograde: true
    });
  }

  const lagna =
    calculateLagna(
      jd,
      place.latitude,
      place.longitude,
      ayanamsha
    );

  const ascendant =
    lagna.sidereal;

  for (
    const planet of planets
  ) {
    planet.house =
      getHouseFromLongitude(
        planet.longitude,
        ascendant
      );
  }

  const houses =
    calculateWholeSignHouses(
      ascendant
    );

  const moon =
    planets.find(
      p => p.name === "Moon"
    );

  const moonNakshatra =
    moon
      ? nakshatra(
          moon.longitude
        )
      : null;

  const dasha =
    moon
      ? calculateVimshottari(
          moon.longitude
        )
      : null;

  return {
    success: true,

    name:
      body.name || "ඔබ",

    birth: {
      date:
        body.birth_date,
      time:
        body.birth_time,
      place:
        place.displayName,
      latitude:
        place.latitude,
      longitude:
        place.longitude,
      timezoneOffset:
        Number(
          body.timezone_offset ??
            5.5
        )
    },

    system: {
      zodiac:
        "Sidereal / Vedic",
      ayanamsha:
        "Lahiri",
      ayanamshaValue:
        Number(
          ayanamsha.toFixed(6)
        ),
      houseSystem:
        "Whole Sign"
    },

    lagna: {
      longitude:
        ascendant,
      sign:
        SIGNS[
          signIndex(
            ascendant
          )
        ],
      degree:
        degreeText(
          ascendant
        ),
      tropicalLongitude:
        lagna.tropical
    },

    moon: {
      longitude:
        moon?.longitude ??
        null,
      sign:
        moon?.sign ??
        null,
      degree:
        moon?.degree ??
        null,
      nakshatra:
        moonNakshatra?.name ??
        null,
      pada:
        moonNakshatra?.pada ??
        null
    },

    planets,

    houses,

    dasha
  };
}

export default {
  async fetch(request) {
    if (
      request.method ===
      "OPTIONS"
    ) {
      return new Response(
        null,
        {
          headers:
            corsHeaders()
        }
      );
    }

    const url =
      new URL(
        request.url
      );

    if (
      request.method ===
        "GET" &&
      url.pathname === "/"
    ) {
      return json({
        ok: true,
        service:
          "Sasthara Janma Kundali API",
        version:
          "2.0",
        engine:
          "Swiss Ephemeris WASM",
        zodiac:
          "Sidereal / Lahiri"
      });
    }

    if (
      request.method ===
        "GET" &&
      url.pathname ===
        "/health"
    ) {
      return json({
        status:
          "healthy",
        engine:
          "Swiss Ephemeris WASM"
      });
    }

    if (
      request.method ===
        "POST" &&
      url.pathname ===
        "/api/kundali"
    ) {
      try {
        const body =
          await request.json();

        if (
          !body ||
          !body.birth_date ||
          !body.birth_time ||
          !body.birth_place
        ) {
          return json(
            {
              success:
                false,
              error:
                "උපන් දිනය, වේලාව සහ ස්ථානය අවශ්‍යයි."
            },
            400
          );
        }

        const result =
          await calculate(
            body
          );

        return json(
          result
        );
      } catch (error) {
        return json(
          {
            success:
              false,
            error:
              error?.message ||
              "Calculation failed."
          },
          500
        );
      }
    }

    return json(
      {
        success:
          false,
        error:
          "Not found"
      },
      404
    );
  }
};
// Deploy latest commit
