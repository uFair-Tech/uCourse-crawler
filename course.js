const puppeteer = require("puppeteer");
const consola = require("consola");
const prompts = require("prompts");
const mongoose = require("mongoose");
const fs = require("fs-extra");

const CONFIGS = {
  campus: undefined,
  campus_code: undefined,
  year: undefined,
  year_code: undefined,
  outputMethods: [],
  mongoUri: undefined,
  Model: undefined,
  browser: {
    headless: true,
    // slowMo: 50,
    args: ["–disable-gpu", "–single-process", "–no-sandbox", "–no-zygote"],
  },
};

const selectOutputMethods = async () => {
  const { value } = await prompts({
    type: "multiselect",
    name: "value",
    message: "Pick output methods",
    choices: [
      { title: "MongoDB", value: "mongo" },
      { title: "Local JSON File", value: "local" },
    ],
    hint: "- Space to select. Return to submit",
    instructions: false,
    min: 1,
  });
  CONFIGS.outputMethods = value;
};

const connectDB = async () => {
  if (!CONFIGS.outputMethods.includes("mongo")) return;
  const { value } = await prompts({
    type: "text",
    name: "value",
    message: "Input your mongoDB URI",
  });
  CONFIGS.mongoUri = value;
  await mongoose.connect(CONFIGS.mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  consola.success("mongoose connected");
};

const getTableName = () => `Course_${CONFIGS.campus}_${CONFIGS.year}`;

const initMongoModel = () => {
  const Course = mongoose.model(getTableName(), {
    code: String,
    title: String,
    credits: Number,
    level: Number,
    summary: String,
    aims: String,
    offering: String,
    convenor: [{ name: String }],
    semester: String, // semesters?
    requisites: String,
    outcome: String,
    class: [
      {
        activity: String,
        numOfWeeks: String,
        numOfSessions: String,
        sessionDuration: String,
      },
    ],
    assessment: [
      {
        type: { type: String }, // thank you mongoose
        weight: String,
        requirements: String,
      },
    ],
    belongsTo: {
      code: String,
      name: String,
    },
  });
  return Course;
};

const initBrowser = async () => {
  const browser = await puppeteer.launch(CONFIGS.browser);
  const page = await browser.newPage();

  consola.start("Starting the browser");
  await page.emulate({
    userAgent:
      "Mozilla/5.0 (PlayBook; U; RIM Tablet OS 2.1.0; en-US) AppleWebKit/536.2+ (KHTML like Gecko) Version/7.2.1.0 Safari/536.2+",
    viewport: {
      width: 600,
      height: 8000,
      isMobile: true,
      hasTouch: true,
    },
  });
  consola.ready("Browser is ready");

  return { browser, page };
};

const preSearch = async (page) => {
  // Home Page
  consola.log("Clicking 'Search for Courses' button...");
  await page.waitForSelector("#UN_PAM_EXTR_WRK_UN_MODULE_PB");
  await page.click("#UN_PAM_EXTR_WRK_UN_MODULE_PB");
  await page.waitForSelector("#UN_PAM_EXTR_WRK_CAMPUS");

  // Search Page
  // select campus
  if (!CONFIGS.campus) {
    consola.log("Selecting a campus...");
    const campuses = await page.evaluate(() =>
      [...document.querySelectorAll('[id="UN_PAM_EXTR_WRK_CAMPUS"] > option')]
        .filter((el) => el.value)
        .map((el) => ({
          value: el.value,
          title: el.innerText,
        }))
    );
    CONFIGS.campus_code = await prompts({
      type: "select",
      name: "campus",
      message: "Which campus?",
      choices: campuses,
    }).then((v) => v.campus);
    CONFIGS.campus = campuses.filter(
      (el) => el.value === CONFIGS.campus_code
    )[0].title;
  }

  await page.select("#UN_PAM_EXTR_WRK_CAMPUS", CONFIGS.campus_code);

  // select year
  consola.log("Waiting for academic year data...");
  await page.waitForSelector(`#UN_PAM_EXTR_WRK_STRM > option[value="3200"]`);
  consola.success("Year data loaded");

  if (!CONFIGS.year) {
    consola.log(`Selecting an academic year'...`);
    const years = await page.evaluate(() =>
      [...document.querySelectorAll('[id="UN_PAM_EXTR_WRK_STRM"] > option')]
        .filter((el) => el.value)
        .map((el) => ({
          value: el.value,
          title: el.innerText,
        }))
    );
    CONFIGS.year_code = await prompts({
      type: "select",
      name: "year",
      message: "Which year?",
      choices: years,
    }).then((v) => v.year);
    CONFIGS.year = years
      .filter((el) => el.value === CONFIGS.year_code)[0]
      .title.split(" ")[0];
  }

  await page.select("#UN_PAM_EXTR_WRK_STRM", CONFIGS.year_code);
};

const getSchools = async (page) => {
  consola.log("Get schools data...");
  const schools = await page.evaluate(() =>
    [
      ...document.querySelectorAll(
        '[id="UN_PAM_EXTR_WRK_UN_PAM_CRSE1_SRCH$0"] > option'
      ),
    ]
      .filter((el) => el.value.length !== 0)
      .map((el) => ({
        code: el.value,
        name: el.innerText,
      }))
  );
  consola.success("Schools data obtained");
  return schools;
};

const searchSchool = async (page, schoolCode) => {
  await page.select('[id="UN_PAM_EXTR_WRK_UN_PAM_CRSE1_SRCH$0"]', schoolCode);
  await page.click('[id="UN_PAM_EXTR_WRK_UN_SEARCH_PB$0"]');
  await Promise.race([
    page.waitForSelector('[id="win0divUN_PAM_CRSE_VW$0"]'),
    page.waitForSelector("#win0divUN_PAM_EXTR_WRK_HTMLAREA8"),
  ]);
};

const getCourses = async (page) => {
  consola.log("Parsing courses...");
  const courses = await page.evaluate(() =>
    [
      ...document.querySelectorAll(
        '[id="UN_PAM_CRSE_VW$scroll$0"] > tbody > tr'
      ),
    ]
      .filter((el) => el.id)
      .map((el, j) => ({
        level: document.getElementById(`UN_PAM_CRSE_VW_UN_LEVEL1_DESCR$${j}`)
          .innerText,
        code: document.getElementById(`CRSE_CODE$${j}`).innerText,
        title: document.getElementById(`UN_PAM_CRSE_VW_COURSE_TITLE_LONG$${j}`)
          .innerText,
        semester: document.getElementById(`SSR_CRSE_TYPOFF_DESCR$${j}`)
          .innerText,
      }))
  );

  consola.ready(`${courses.length} Courses loaded`);
  return courses;
};

const upload = async (row) => {
  if (CONFIGS.outputMethods.includes("mongo")) {
    if (!CONFIGS.Model) {
      CONFIGS.Model = initMongoModel();
    }
    const { Model } = CONFIGS;
    const instance = new Model(row);
    await instance.save();
  }

  if (CONFIGS.outputMethods.includes("local")) {
    const tableName = getTableName();
    const fileName = `./dist/${tableName}.json`;
    let json = { data: [] };
    try {
      json = fs.readJSONSync(fileName);
    } catch (e) {
      // no file;
      consola.log("Create a new JSON file.");
    }
    json.data.push(row);
    fs.outputJsonSync(fileName, json, { spaces: 2 });
  }
};

const close = async () => {
  process.exit();
};

const main = async () => {
  try {
    await selectOutputMethods();

    await connectDB();

    const { browser, page } = await initBrowser();

    await page.goto(
      "https://mynottingham.nottingham.ac.uk/psp/psprd/EMPLOYEE/HRMS/c/UN_PROG_AND_MOD_EXTRACT.UN_PAM_CRSE_EXTRCT.GBL?"
    );
    await page.goto(
      "https://campus.nottingham.ac.uk/psc/csprd/EMPLOYEE/HRMS/c/UN_PROG_AND_MOD_EXTRACT.UN_PAM_CRSE_EXTRCT.GBL?%252fningbo%252fasp%252fmoduledetails.asp"
    );

    await preSearch(page);
    consola.success("Config Selected! GO GO GO! 🚀🚀🚀");

    const schools = await getSchools(page);

    consola.log("Traversing...");
    for (let i = 0; i < schools.length; i++) {
      const school = schools[i];

      consola.start(`School <${school.name}> [${i + 1}/${schools.length}]`);
      await searchSchool(page, school.code);

      if ((await page.$("win0divUN_PAM_EXTR_WRK_HTMLAREA8")) !== null) {
        consola.info("No courses");
        consola.log("Backing to search page");
        await page.click("UN_PAM_EXTR_WRK_UN_MODULE_PB");
        await page.waitForSelector("#UN_PAM_EXTR_WRK_CAMPUS");
      } else {
        // for this school
        const courses = await getCourses(page);

        // 👇
        for (let j = 0; j < courses.length; j++) {
          const course = courses[j];

          consola.start(
            `\n> Course <${course.title}> [${j + 1}/${
              courses.length
            }] in \n> School <${school.name}> [${i + 1}/${schools.length}]`
          );

          await page.click(`[id="CRSE_CODE$${j}"]`, {
            button: "middle",
            // delay: 100,
          });

          // await page.waitFor(10000)
          await page.waitForSelector('[id="UN_PAM_CRSE_DTL_SUBJECT_DESCR$0"]');
          // await page.screenshot({path: `l${j}.png`});

          const result = await page.evaluate((belongsTo) => {
            const gE = (id) => document.getElementById(id)?.innerHTML?.trim();
            const gT = (id) =>
              [
                ...document.querySelectorAll(`[id="${id}"] > tbody > tr`),
              ].filter((el) => el.id);

            return {
              code: gE("UN_PAM_CRSE_DTL_SUBJECT_DESCR$0"),
              title: gE("UN_PAM_CRSE_DTL_COURSE_TITLE_LONG$0"),
              credits: Number(gE("UN_PAM_CRSE_DTL_UNITS_MINIMUM$0")),
              level: Number(gE("UN_PAM_CRSE_DTL_UN_LEVELS$0")),
              summary: gE("UN_PAM_CRSE_DTL_UN_SUMMARY_CONTENT$0"),
              aims: gE("UN_PAM_CRSE_DTL_UN_AIMS$0"),
              offering: gE("ACAD_ORG_TBL_DESCRFORMAL$0"),
              convenor: gT("UN_PAM_CRS_CONV$scroll$0").map((_, k) => ({
                name: gE(`UN_PAM_CRS_CONV_NAME52$${k}`),
              })),
              semester: gE("SSR_CRSE_TYPOFF_DESCR$0"), // semesters?
              requisites: gE("UN_PAM_CRSE_WRK_UN_PRE_CO_REQ_GRP$0"),
              outcome: gE("UN_QAA_CRSE_OUT_UN_LEARN_OUTCOME$0"),
              class: gT("UN_PAM_CRSE_FRQ$scroll$0").map((_, k) => ({
                activity: gE(`UN_PAM_CRSE_FRQ_SSR_COMPONENT$${k}`),
                numOfWeeks: gE(`UN_PAM_EXTR_WRK_UN_CRSE_DURATN_WKS$${k}`),
                numOfSessions: gE(`UN_PAM_EXTR_WRK_UN_CRSE_NUM_SESN$${k}`),
                sessionDuration: gE(`UN_PAM_EXTR_WRK_UN_CRSE_DURATN_SES$${k}`),
              })),
              assessment: gT("UN_QA_CRSE_ASAI$scroll$0").map((_, k) => ({
                type: gE(`UN_QA_CRSE_ASAI_DESCR50$${k}`),
                weight: gE(`UN_QA_CRSE_ASAI_SSR_CW_WEIGHT$${k}`),
                requirements: gE(`UN_QA_CRSE_ASAI_SSR_DESCRLONG$${k}`),
              })),
              belongsTo,
            };
          }, school);

          consola.info("Uploading...");
          await upload(result); // 👈
          consola.success("Uploaded");

          consola.success("Done");

          consola.log("Reloading Page...");
          await page.reload();
          await preSearch(page);
          await searchSchool(page, school.code);
        }
        // 👆

        await page.reload();
        await preSearch(page);
      }
    }

    await browser.close();
    consola.success("All done! 👍👍👍");
    await close();
  } catch (e) {
    consola.fatal(e);
  }
};

main();
