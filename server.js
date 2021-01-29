require('dotenv').config();
const express = require('express');
const dns = require('dns'); // needed for domain validations
const cors = require('cors');
const bodyParser = require('body-parser'); // needed for form submissions
const Database = require("@replit/database"); // require the replit database
const db = new Database(); // create a replit database
const app = express();

// Basic Configuration
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.urlencoded({extended: false})); // activate body-parser middleware

app.use('/public', express.static(`${process.cwd()}/public`)); // process.cwd() returns the current working directory

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});

/* ALL THE APP BELOW HERE */
var urlStoredAt; // get the starting point for the short url codes. this was originally meant to allow for the database being constantly added to (hence the +1 at the end) but I'd rather have everything be deleted at the app start.
db.list().then(keys => {
  keys.forEach(key => {
    db.delete(key).then(() => {
      db.list().then(keys => {
        urlStoredAt = keys.length + 1;
      })
    })
  })
})

// global function to add the shortcode and url to the database
const addShortcodeToDB = (location, url) => {
  db.set(location, url);
};

// need a regex and function to remove the protocols and paths from the submitted domain later on to validate using node dns
const protocolRegEx = /^https?\:\/\//g;
const pathsRegex = /\/\w*/g;
const replaceRegEx = (url, regex) => {
  let newurl = url.replace(regex, '');
  return newurl;
}

// this is where everything happens on the form submit
app.post("/api/shorturl/new", (req, res) => {
  let urlToBeShortened = req.body.url; // store what is submitted
  let hostname = replaceRegEx(urlToBeShortened, protocolRegEx); // try to get just the hostname
  let nopaths = replaceRegEx(hostname, pathsRegex); // remove any paths if there are any
  dns.lookup(nopaths, (err, addresses, family) => {
    if (err) { // return an error if the lookup fails
      res.json({
        error: 'invalid url'
      });
    } else {
      addShortcodeToDB(urlStoredAt, urlToBeShortened); // store the pair in the db
      res.json({
        original_url: urlToBeShortened,
        short_url: urlStoredAt
      });
      urlStoredAt++; // increment to the next shorturl number for storage
    }
  });
});

// this is where everything happens on the request for the short code you were given
app.get("/api/shorturl/:number", (req, res) => {
  let shorturl = req.params.number;
  let destination = db.get(shorturl).then(value => {
    if (value === null) { // if you requested a code that isn't in the db, return an error
      res.json({
        error: 'invalid url'
      });
    } else if (!value.match(protocolRegEx)) {
      value = 'https://' + value; // add a procotol to the url if there wasn't one originally so the redirect works
      res.redirect(value);
    } else {
      res.redirect(value);
    }
  }).catch(e => {
    console.log(e); // log any errors because there might be
  });
});