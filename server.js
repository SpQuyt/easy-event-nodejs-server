const express = require('express');
const app = express();
const port = 3000;
var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;
var ObjectId = require('mongodb').ObjectID;
var url = 'mongodb://localhost:27017/';

app.get('/events', (req, res) => {
  MongoClient.connect(url, { useNewUrlParser: true }, async function (err, db) {
    if (err) {
      res.status(400);
      res.json({message: 'Unable to connect to the mongoDB server. Error:', err});
    } else {
      var projectI = db.db("projectI");

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

app.listen(port, () => console.log("Example app listening on port", port));

