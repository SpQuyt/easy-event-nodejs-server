const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;
var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;
var ObjectId = require('mongodb').ObjectID;
var url = 'mongodb://admin123:admin123@ds131942.mlab.com:31942/easy-event';

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/events', (req, res) => {
  MongoClient.connect(url, { useNewUrlParser: true }, async function (err, db) {
    if (err) {
      res.status(400);
      res.json({message: 'Unable to connect to the mongoDB server. Error:', err});
    } else {
      var projectI = db.db("easy-event");

      //await this to return a promise
      let result_users = await projectI.collection("users").find({name: "Aq"}).toArray();
      var query = {user_id: ObjectId(result_users[0]._id)};

      //print the result
      projectI.collection("events").find(query).toArray(function (err, result) {
        if (err) throw err;
        res.json(result);
      });

      db.close();
    }
  });
});

app.post('/QR', (req,res) => {
  if (req.method == 'POST') {
    MongoClient.connect(url, { useNewUrlParser: true }, async function (err, db) {
      if (err) {
        res.status(400);
        res.json({message: 'Unable to connect to the mongoDB server. Error:', err});
      } else {
        var projectI = db.db("easy-event");
        var req_id = req.body.QRcode;

        let result_from_id = await projectI.collection("guests").find({_id: ObjectId(req_id)}).toArray();
        if (result_from_id.length == 0) {
          res.json({message: 'No guest ID in database.'})
        }
        else {
          if (result_from_id[0].check_in.checked == false) {
            await projectI.collection("guests").updateOne({_id: ObjectId(req_id)}, {$set: {"check_in.checked": true}})
            res.json({message: 'Done.'})
          }
          else {
            res.json({message: 'Guest ID already checked.'})
          }
        }
      }
    });
  }
});

app.listen(port, () => console.log("Example app listening on port", port));

