import {
  Constants,
  load
} from "@fusionstrings/swiss-eph";

const {
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
} = Constants;

let ephPromise;

function getEph() {
  if (!ephPromise) {
    ephPromise = load();
  }

  return ephPromise;
}

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
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type":
          "application/json; charset=utf-8",
        ...corsHeaders()
      }
    }
  );
}

function normalize360(value) {
  return (
    ((Number(value) % 360) + 360) % 360
  );
}

function signIndex(longitude) {
  return Math.floor(
    normalize360(longitude) / 30
  );
}

function degreeText(longitude) {
  const x = normalize360(longitude);
  const d = x % 30;

  const deg = Math.floor(d);
  const minFloat = (d - deg) * 60;
  const min = Math.floor(minFloat);

  let sec = Math.round(
    (minFloat - min) * 60
  );

  let finalMin = min;

  if (sec === 60) {
    sec = 0;
    finalMin++;
  }

  if (finalMin === 60) {
    finalMin = 0;
  }

  return `${deg}° ${String(finalMin).padStart(2, "0")}' ${String(sec).padStart(2, "0")}"`;
}

function nakshatra(longitude) {
  const normalized =
    normalize360(longitude);

  const span = 360 / 27;
  const padaSpan = span / 4;

  const index = Math.min(
    26,
    Math.floor(normalized / span)
  );

  const inside =
    normalized - index * span;

  const pada = Math.min(
    4,
    Math.floor(
      inside / padaSpan
    ) + 1
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

  const dateParts =
    date.split("-").map(Number);

  const timeParts =
    time.split(":").map(Number);

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

  const offset =
    Number(timezoneOffset ?? 5.5);

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

  const utc =
    new Date(utcMillis);

  return {
    year:
      utc.getUTCFullYear(),

    month:
      utc.getUTCMonth() + 1,

    day:
      utc.getUTCDate(),

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
    encodeURIComponent(
      place.trim()
    );

  const response =
    await fetch(url, {
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

  const data =
    await response.json();

  if (
    !Array.isArray(data) ||
    data.length === 0
  ) {
    throw new Error(
      "උපන් ස්ථානය හමු නොවීය."
    );
  }

  const latitude =
    Number(data[0].lat);

  const longitude =
    Number(data[0].lon);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    throw new Error(
      "Coordinates වැරදියි."
    );
  }

  return {
    latitude,
    longitude,
    displayName:
      data[0].display_name
  };
}

function getPosition(result) {
  if (!result) {
    throw new Error(
      "Swiss Ephemeris result හිස්."
    );
  }

  if (
    result.xx &&
    typeof result.xx[0] ===
      "number"
  ) {
    return {
      longitude:
        result.xx[0],

      speed:
        typeof result.xx[3] ===
        "number"
          ? result.xx[3]
          : 0,

      error:
        result.error || ""
    };
  }

  if (
    typeof result.longitude ===
      "number"
  ) {
    return {
      longitude:
        result.longitude,

      speed:
        typeof result.longitude_speed ===
        "number"
          ? result.longitude_speed
          : 0,

      error:
        result.error || ""
    };
  }

  throw new Error(
    "Swiss Ephemeris result format හඳුනාගත නොහැක."
  );
}

function calculateLagna(
  eph,
  jd,
  latitude,
  longitude,
  ayanamsha
) {
  const gst =
    Number(
      eph.swe_sidtime(jd)
    );

  const lst =
    gst + longitude / 15;

  const theta =
    normalize360(lst * 15) *
    Math.PI /
    180;

  const latRad =
    latitude *
    Math.PI /
    180;

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

  let tropical =
    Math.atan2(
      numerator,
      denominator
    ) *
    180 /
    Math.PI;

  tropical =
    normalize360(tropical);

  const sidereal =
    normalize360(
      tropical -
      ayanamsha
    );

  return {
    tropical,
    sidereal
  };
}

function houseFromLongitude(
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

function calculateHouses(
  ascendant
) {
  const lagna =
    signIndex(ascendant);

  return Array.from(
    { length: 12 },
    (_, i) => {
      const sign =
        (lagna + i) % 12;

      return {
        house: i + 1,
        sign: SIGNS[sign],
        signIndex: sign
      };
    }
  );
}

function calculateDasha(
  moonLongitude
) {
  const nk =
    nakshatra(
      moonLongitude
    );

  const startingIndex =
    nk.index % 9;

  const first =
    DASHA_SEQUENCE[
      startingIndex
    ];

  const elapsed =
    nk.inside / nk.span;

  const remaining =
    1 - elapsed;

  const balance =
    first[1] * remaining;

  const sequence = [];

  for (let i = 0; i < 9; i++) {
    const lord =
      DASHA_SEQUENCE[
        (startingIndex + i) % 9
      ];

    const years =
      i === 0
        ? balance
        : lord[1];

    sequence.push({
      lord: lord[0],
      years:
        Number(
          years.toFixed(4)
        )
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
      first[0],

    balanceYears:
      Number(
        balance.toFixed(4)
      ),

    sequence
  };
}

async function calculate(body) {
  const eph =
    await getEph();

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
    eph.swe_julday(
      utc.year,
      utc.month,
      utc.day,
      utc.hour,
      SE_GREG_CAL
    );

  eph.swe_set_sid_mode(
    SE_SIDM_LAHIRI,
    0,
    0
  );

  const ayanamsha =
    Number(
      eph.swe_get_ayanamsa_ut(jd)
    );

  const flags =
    SEFLG_SWIEPH |
    SEFLG_SPEED |
    SEFLG_SIDEREAL;

  const planets = [];

  for (
    const [
      name,
      id,
      symbol
    ] of PLANETS
  ) {
    const result =
      eph.swe_calc_ut(
        jd,
        id,
        flags
      );

    const p =
      getPosition(result);

    const longitude =
      normalize360(
        p.longitude
      );

    planets.push({
      name,
      symbol,
      longitude,

      sign:
        SIGNS[
          signIndex(
            longitude
          )
        ],

      degree:
        degreeText(
          longitude
        ),

      house: null,

      retrograde:
        p.speed < 0
    });
  }

  const rahu =
    planets.find(
      p => p.name === "Rahu"
    );

  if (rahu) {
    const ketu =
      normalize360(
        rahu.longitude + 180
      );

    planets.push({
      name: "Ketu",
      symbol: "☋",
      longitude: ketu,

      sign:
        SIGNS[
          signIndex(ketu)
        ],

      degree:
        degreeText(ketu),

      house: null,

      retrograde: true
    });
  }

  const lagna =
    calculateLagna(
      eph,
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
      houseFromLongitude(
        planet.longitude,
        ascendant
      );
  }

  const houses =
    calculateHouses(
      ascendant
    );

  const moon =
    planets.find(
      p => p.name === "Moon"
    );

  const moonNk =
    moon
      ? nakshatra(
          moon.longitude
        )
      : null;

  const dasha =
    moon
      ? calculateDasha(
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
        moonNk?.name ??
        null,

      pada:
        moonNk?.pada ??
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
        version: "4.0",
        engine:
          "Swiss Ephemeris 0.2.1",
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
      try {
        const eph =
          await getEph();

        return json({
          status:
            "healthy",

          engine:
            "Swiss Ephemeris",

          version:
            typeof eph.version ===
            "function"
              ? eph.version()
              : "0.2.1"
        });
      } catch (error) {
        return json(
          {
            status:
              "error",

            error:
              error?.message ||
              "Swiss Ephemeris failed"
          },
          500
        );
      }
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
              success: false,
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
            success: false,
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
        success: false,
        error:
          "Not found"
      },
      404
    );
  }
};
