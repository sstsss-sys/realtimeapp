const { chromium } = require("playwright");
const fs = require("fs");

const countries =
  require("./countries.json");

const historyPath =
  "./apple-music-history.json";

const allHistoryPath =
  "./apple-music-all-history.json";
  const usHistoryPath = "./us-history.json";

function getHistory() {

  try {

    if (
      fs.existsSync(
        historyPath
      )
    ) {

      return JSON.parse(
        fs.readFileSync(
          historyPath,
          "utf8"
        )
      );

    }

    return {
      lastUpdated: "",
      entries: []
    };

  } catch {

    return {
      lastUpdated: "",
      entries: []
    };

  }

}

function getAllHistory() {

  try {

    if (
      fs.existsSync(
        allHistoryPath
      )
    ) {

      return JSON.parse(
        fs.readFileSync(
          allHistoryPath,
          "utf8"
        )
      );

    }

    return [];

  } catch {

    return [];

  }

}

function getUsHistory() {

  try {

    if (
      fs.existsSync(
        usHistoryPath
      )
    ) {

      return JSON.parse(
        fs.readFileSync(
          usHistoryPath,
          "utf8"
        )
      );

    }

    return [];

  } catch {

    return [];

  }

}


function isJiminSong(
  artist
) {

  return artist
    .toLowerCase()
    .includes(
      "jimin"
    );

}

(async () => {

  const browser =
    await chromium.launch({
      headless: true
    });

 const history =
  getHistory();

const usHistory =
  getUsHistory();

const allHistory =
  getAllHistory();

const previousEntries =
  history.entries || [];


  const allEntries =
    [];

const page =
  await browser.newPage();

await page.goto(
  "https://music.apple.com/us/charts/songs",
  {
    waitUntil:
      "networkidle"
  }
);

await page.waitForTimeout(
  5000
);

const scrollable =
  await page.locator(
    "#scrollable-page"
  );

for (
  let i = 0;
  i < 20;
  i++
) {

  await scrollable.evaluate(
    el => {
      el.scrollBy(
        0,
        5000
      );
    }
  );

  await page.waitForTimeout(
    500
  );

}

const usTop10 =
  await page.evaluate(
    () => {

      return [
        ...document.querySelectorAll(
          'a[href*="/song/"]'
        )
      ]
      .slice(0, 10)
      .map(a => {

        const card =
          a.closest(
            '[aria-label]'
          ) ||
          a.parentElement;

        const aria =
          card?.getAttribute(
            "aria-label"
          ) || "";

        return aria;

      });

    }
  );

await page.close();
const oldUs =
  JSON.stringify(
    usHistory
  );

const newUs =
  JSON.stringify(
    usTop10
  );

if (
  oldUs === newUs
) {

  console.log(
    "🟰 US chart not updated"
  );

  await browser.close();

  return;

}

console.log(
  "📈 US chart updated"
);

fs.writeFileSync(
  usHistoryPath,
  JSON.stringify(
    usTop10,
    null,
    2
  )
);

  const BATCH_SIZE =
    10;

  for (
    let i = 0;
    i < countries.length;
    i += BATCH_SIZE
  ) {

    const batch =
      countries.slice(
        i,
        i + BATCH_SIZE
      );

    const results =
      await Promise.all(

        batch.map(
          async country => {

            const page =
              await browser.newPage();

            try {

              console.log(
                `🌍 ${country.country}`
              );

              await page.goto(
                `https://music.apple.com/${country.code}/charts/songs`,
                {
                  waitUntil:
                    "networkidle"
                }
              );

              await page.waitForTimeout(
                5000
              );

              const scrollable =
                await page.locator(
                  "#scrollable-page"
                );

              let count = 0;
              let lastCount = 0;

              while (
                count < 200
              ) {

                await scrollable.evaluate(
                  el => {

                    el.scrollBy(
                      0,
                      5000
                    );

                  }
                );

                await page.waitForTimeout(
                  1000
                );

                count =
                  await page
                    .locator(
                      'a[href*="/song/"]'
                    )
                    .count();

                if (
                  count ===
                  lastCount
                ) {
                  break;
                }

                lastCount =
                  count;

              }

              const songs =
                await page.evaluate(
                  countryName => {

                    const seen =
                      new Set();

                    return [
                      ...document.querySelectorAll(
                        'a[href*="/song/"]'
                      )
                    ]
                    .map(a => {

                      const card =
                        a.closest(
                          '[aria-label]'
                        ) ||
                        a.parentElement;

                      const aria =
                        card?.getAttribute(
                          "aria-label"
                        ) || "";

                      let clean =
                        aria.replace(
                          /^Explicit,\s*/,
                          ""
                        );

                      const parts =
                        clean.split(
                          ","
                        );

                      const title =
                        parts.shift()
                          ?.trim() || "";

                      const artist =
                        parts.join(
                          ","
                        ).trim();

                      const rank =
                        parseInt(
                          card
                            ?.querySelector(
                              '[data-testid*="rank"]'
                            )
                            ?.textContent
                            ?.trim()
                        ) || null;

                      const image =
                        card
                          ?.querySelector(
                            "picture source"
                          )
                          ?.getAttribute(
                            "srcset"
                          )
                          ?.split(
                            ","
                          )[0]
                          ?.split(
                            " "
                          )[0]
                          || "";

                      return {

                        country:
                          countryName,

                        rank,

                        title,

                        artist,

                        image,

                        songLink:
                          a.href

                      };

                    })
.filter(item => {

                      if (
                        seen.has(
                          item.songLink
                        )
                      ) {
                        return false;
                      }

                      seen.add(
                        item.songLink
                      );

                      return true;

                    })
                    .sort(
                      (a, b) =>
                        a.rank -
                        b.rank
                    );

                  },
                  country.country
                );

              await page.close();

              return songs.filter(
                song =>
                  isJiminSong(
                    song.artist
                  )
              );

            } catch (err) {

              console.log(
                `❌ ${country.country}`,
                err.message
              );

              await page.close();

              return [];

            }

          }
        )

      );

    allEntries.push(
      ...results.flat()
    );

    console.log(
      `✅ Batch ${
        Math.floor(
          i / BATCH_SIZE
        ) + 1
      } finished`
    );

  }

  const finalEntries =
    allEntries.map(
      current => {

        const previous =
          previousEntries.find(
            item =>
              item.country ===
                current.country &&
              item.title ===
                current.title
          );

        let status =
          "NEW";

        let change =
          "NEW";

        let previousRank =
          null;

        if (previous) {

          previousRank =
            previous.rank;

          const diff =
            previous.rank -
            current.rank;

          if (diff > 0) {

            status =
              "up";

            change =
              `+${diff}`;

          } else if (
            diff < 0
          ) {

            status =
              "down";

            change =
              `${diff}`;

          } else {

            status =
              "stable";

            change =
              "—";

          }

        } else {

          const appearedBefore =
            allHistory.some(
              old =>
                old.country ===
                  current.country &&
                old.title ===
                  current.title
            );

          if (
            appearedBefore
          ) {

            status =
              "RE";

            change =
              "RE";

          }

        }

        return {

          country:
            current.country,

          rank:
            current.rank,

          previousRank,

          change,

          status,

          title:
            current.title,

          artist:
            current.artist,

          image:
            current.image,

          songLink:
            current.songLink

        };

      }
    );

  const mergedHistory = [
    ...allHistory
  ];

  finalEntries.forEach(
    song => {

      const exists =
        mergedHistory.find(
          item =>
            item.country ===
              song.country &&
            item.title ===
              song.title
        );

      if (!exists) {

        mergedHistory.push({
          country:
            song.country,

          title:
            song.title
        });

      }

    }
  );

  fs.writeFileSync(
    allHistoryPath,
    JSON.stringify(
      mergedHistory,
      null,
      2
    )
  );

  const output = {

    updatedDate:
      new Date()
        .toISOString(),

    totalEntries:
      finalEntries.length,

    entries:
      finalEntries.sort(
        (a, b) =>
          a.rank -
          b.rank
      )

  };

  fs.writeFileSync(
    historyPath,
    JSON.stringify(
      {
        lastUpdated:
          output.updatedDate,
        entries:
          finalEntries
      },
      null,
      2
    )
  );

  fs.writeFileSync(
    "apple-music-realtime.json",
    JSON.stringify(
      output,
      null,
      2
    )
  );

  console.log(
    `🔥 ${finalEntries.length} Jimin entries found`
  );

  console.log(
    "Saved apple-music-realtime.json"
  );

  await browser.close();

})();
