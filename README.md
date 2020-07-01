# uCourse-crawler
🎒 Scrape the courses info from the University of Nottingham's website. (Different campuses and academic years supported.)

## Requirements

- Nodejs
- MongoDB (optional)

## Usage

```bash
git clone https://github.com/Songkeys/uCourse-crawler.git
cd uCourse-crawler
npm i
npm start
```

## Demo

![demo](https://ae01.alicdn.com/kf/U8dea349724724abaa24cabb4cfa83b27y.jpg)

## Output Methods

There are two output methods provided:

1. MongoDB (Recommended)
2. Local JSON file

### Output (MongoDB)

For mongoDB, you will need to input a mongo [connection string URI](https://docs.mongodb.com/manual/reference/connection-string/). The output will be stored in a table called `course_[campus]_[year]`. E.g. `course_china_2020`.

The output example:

![output-mongodb](https://ae01.alicdn.com/kf/U0b38637fccbf47e9a92d1966005711d9T.jpg)

### Output (JSON file)

For local JSON file, the output will be in a JSON format stored in `/dist/[tablename].json`. 

The output example:

![output-json](https://ae01.alicdn.com/kf/Ue83678fcf72e4906846dad02c87c00f06.jpg)

## Size & Time

The estimated output size will be 2~3 MB per campus per year.

The estimated crawling time will be 30~50 mins per campus per year (depending on your network). 

## Todo

- [ ] Concurency using [pupeteer-cluster](https://github.com/thomasdondorf/puppeteer-cluster)
- [ ] Breakpoint resume

## Resources

- Resouce website: <https://mynottingham.nottingham.ac.uk/psp/psprd/EMPLOYEE/HRMS/c/UN_PROG_AND_MOD_EXTRACT.UN_PAM_CRSE_EXTRCT.GBL>
  - There is also a short url for this: <https://u.nu/course>. (You may need to visit twice to open it for some authorization issue.)

