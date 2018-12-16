const express = require('express');
const app = express();
const port = 3005;
const bodyParser = require('body-parser');
const cors = require('cors');
const md5 = require('md5')
const mongodb = require('mongodb');
const MongoClient = mongodb.MongoClient;
const ObjectId = require('mongodb').ObjectID;
const Mailer = require('./mailer')
const QRCode = require('qrcode')
const jwt = require('jsonwebtoken')

const url = 'mongodb://admin123:admin123@ds131942.mlab.com:31942/easy-event';
const salt = 'namquocsonha';
const home_url = 'http://127.0.0.1:3000'
const jwt_key = 'shenevaknows'

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());
app.use(express.static('public'));

let db;
MongoClient.connect(url, { useNewUrlParser: true }, function(err, database) {
  if(err) throw err;
  db = database.db("easy-event");
  console.log("Database OK");
});

// Load all events without param "user"
app.get('/event', (req, res) => {
  db.collection("events").find().toArray()
  .then(result => {
    res.json(result)
  })
  .catch(err => {res.json({message: err})})
})

app.post('/event', (req, res) => {
  db.collection("events").find({
    _id: ObjectId(req.body.event_id)
  }).toArray()
  .then(result => {
    res.json(result[0])
  })
  .catch(err => {res.json({message: err})})
})

// Search user events
app.post('/event/search', (req, res) => {
  db.collection("events").find({
    name: {$regex: `${req.body.key_word}`, $options: 'i'} 
  }).toArray()
  .then(result => {
    res.json(result)
  })
  .catch(err => {res.json({message: err})})
});

// List guests of event
app.post('/event/guest', (req, res) => {
  db.collection("guests").find({
    eventID: ObjectId(req.body.event_id)
  }).toArray()
  .then(result => {
    if (result.length == 0) {
      res.json({message: "not OK"})
    }
    else {
      res.json({message: "OK", result: result})
    }   
  })
  .catch(err => {res.json({message: err})})
})

// Verify email
app.post('/verify', (req, res) => {
  const { hashed, guest_email, event_id } = req.body;
  const verified = (hashed === md5(guest_email + event_id + salt))
  if (!verified) return res.json({message: "not OK"})
  db.collection("guests").updateOne({ 
    eventID: event_id,
    email: guest_email
  }, {
    $set: {
      "email_verified": true 
    }
  })
  .then(result => {
    res.json({message: "OK"})
  })
  .catch(err => {res.json({message: err})})
})

// Guest register
app.put('/event/guest', (req, res) => {
  let guest = req.body;
  const hash = md5(guest.email + guest.eventID + salt);
  const link = `${home_url}/verify/${hash}/${guest.email}/${guest.eventID}`
  guest.email_verified = false;
  guest.eventID = ObjectId(guest.eventID);
  guest.accepted = false;
  guest.check_in = {
    checked: false,
    timestamp: null
  }
  db.collection("guests").insertOne(guest)
  .then(result => {
    Mailer.sendVerifyEmail(guest, link);
    res.json({message: "OK"})
  })
  .catch(err => {res.json({message: err})})
})

// Signup API
app.post('/user/signup', (req, res) => {
  db.collection("users").findOne({ 
    username: req.body.username
  })
  .then(result => {
    if (result.length != 0)
      return res.json({error: "Username is exist"})
    
  })
  .catch(err => {res.json({error: err})})
});

// Login API
app.post('/user/login', (req, res) => {
  db.collection("users").findOne({ 
    username: req.body.username,
    password: req.body.password
  })
  .then(result => {
    if (result.length == 0)
      return res.json({error: "User not found"})
    jwt.sign({ user_id: result._id }, jwt_key, {expiresIn: '6h'}, function(err, token) {
      if (err) return res.json({error: err})
      res.json({
        success: true, 
        token: token,
        user_id: result._id,
        username: result.username,
        name: result.name
      }) 
    });
  })
  .catch(err => {res.json({error: err})})
});

// Load events in Home screen with param "user"
app.post('/user/event', (req, res) => {
  db.collection("users").find({ _id: ObjectId(req.body.user_id) }).toArray()
  .then(result_1 => {
    const query = { user_id: ObjectId(result_1[0]._id) };

    db.collection("events").find(query).toArray()
    .then(result_2 => {
      res.json(result_2)
    })
    .catch(err => {res.json({message: err})})
  })
  .catch(err => {res.json({message: err})})
});

// Search user events
app.post('/user/event/search', (req, res) => {
  db.collection("events").find({
    user_id: ObjectId(req.body.user_id),
    name: {$regex: `${req.body.key_word}`, $options: 'i'} 
  }).toArray()
  .then(result => {
    if (result.length === 0) {
      res.json({message: "not OK"});
    }
    else {
      res.json({message: "OK", result: result});
    }
  })
  .catch(err => {res.json({message: err})})
});

// --------- Authorization Middleware ---------
app.use(function(req, res, next) {
  if (!req.headers.authorization) {
    return res.status(403).json({ error: 'No credentials sent!' });
  }
  const token = req.headers.authorization.split(" ")[1];
  jwt.verify(token, jwt_key, (err, decoded) => {
    if (err) return res.json({error: err})
    req.user_id = decoded._id;
    next();
  });
});

// --- All protected requests go after this ---
// * Request header must have: Authorization

app.post('/test', (req, res) => {
  return res.json({'status': 'test token'})
})

// Guest Accepted
app.post('/event/guest/accept', (req, res) => {
  const guest = req.body;
  console.log(req.body._id);
  db.collection("guests")
  .updateOne({ _id: ObjectId(guest._id) }, { $set: { "accepted": true } })
  .then(result => {
    db.collection("guests")
    .findOne({ _id: ObjectId(guest._id) })
    .then(res => {
      QRCode.toDataURL(res._id.toString(), (err, url) => {
        Mailer.sendTicketEmail(res, url)
      })
      return res.json({message: "OK"})
    })
    .catch(err => {res.json({message: err})})
  })
  .catch(err => {res.json({message: err})})
})

// Check QR code
app.post('/qr', (req, res) => {
  var temp = req.body.QRcode;
  var req_id = [];
  for (var i = 1; i < temp.length-1; i++) {
    req_id.push(temp[i])
  }
  req_id = req_id.join("")
  console.log(req_id);
  const currentDate = new Date();
  const DYM = currentDate.getDate() + '/' + (currentDate.getMonth()+1) + '/' + currentDate.getFullYear() + ', ';
  const time = currentDate.toLocaleTimeString(currentDate);

  db.collection("guests").findOne({ _id: ObjectId(req_id)})
  .then(result_1 => {
    if (result_1.length == 0) {
      res.json({ message: 'No guest ID in database.' })
    }
    else if (result_1.eventID != req.body.event_id) {
      res.json({ message: 'No guest ID in database.' })
    }
    else if (result_1.check_in.checked == false) {
      db.collection("guests").updateOne({ _id: ObjectId(req_id) }, 
      { $set: { "check_in.timestamp": DYM + time, "check_in.checked": true }})
      .then(result_2 => {
        res.json({ message: 'Done.', time: DYM + time, name: result_1.name })
      })
    }
    else {
      res.json({ message: 'Guest ID already checked.' })
    }
  })
});

app.listen(port, () => console.log("Easy Event listening on port", port));