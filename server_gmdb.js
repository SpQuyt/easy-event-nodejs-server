const express = require('express');
const app = express();
const port = 3005;
const bodyParser = require('body-parser');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const https = require("superagent");
const DomParser = require('dom-parser');
const parser = new DomParser();
const locationHanoi = 'location=YTo0OntzOjk6ImZhdm91cml0ZSI7YjowO3M6NDoidHlwZSI7czo2OiJyZWdpb24iO3M6NjoicmVnaW9uIjthOjM6e3M6MjoiaWQiO2k6OTtzOjQ6Im5hbWUiO3M6OToiSMOgIE7hu5lpIjtzOjQ6InNsdWciO3M6NjoiaGEtbm9pIjt9czo4OiJsb2NhdGlvbiI7YToyOntzOjM6ImxhdCI7czowOiIiO3M6MzoibG5nIjtzOjA6IiI7fX0%3D; path=/; domain=.moveek.com; Expires=Tue, 19 Jan 2038 03:14:07 GMT;'

class Crawler {
  async crawlMovieShowtime(moveek_id, date) {
    const res = await https.get("https://moveek.com/movie/showtime/" +
      moveek_id +
      "?date=" + date +
      "&version=")
      .set('Cookie', locationHanoi);

    let list_crawl = [];
    let list_crawl_group = [];

    for (let i = 0; i < res.body.cineplexes.length; i++) {
      for (let j = 0; j < res.body.cineplexes[i].cinemas.length; j++) {
        list_crawl_group.push({
          cine_id: res.body.cineplexes[i].cinemas[j].id,
          cine_name: res.body.cineplexes[i].cinemas[j].name
        });
      }
      list_crawl.push({
        cine_group_id: res.body.cineplexes[i].data.id,
        cine_group_name: res.body.cineplexes[i].data.name,
        list_crawl_group: list_crawl_group,
      });
      list_crawl_group = [];
    }
    return list_crawl;
  }

  async crawlMovieShowtimeFromCine(moveek_id, cine_id, date) {
    const res = await https.get("https://moveek.com/movie/showtime/" +
      moveek_id +
      "?cinema=" + cine_id +
      "&date=" + date +
      "&version=")
      .set('Cookie', locationHanoi);

    const ele = parser.parseFromString(res.text, "text/html");
    const as = ele.getElementsByTagName('a');

    let data = [];

    for (let index = 0; index < as.length; index++) {
      const element = as[index];
      data.push(element.getElementsByTagName('span')[0].textContent.slice(2, 7));
    }
    return data;
  }

  async crawlCineFromMovie(moveek_id, date) {
    const res = await https.get("https://moveek.com/movie/showtime/" +
      moveek_id +
      "?date=" + date +
      "&version=")
      .set('Cookie', locationHanoi);
    let cine_list = [];
    for (let i = 0; i < res.body.cineplexes.length; i++) {
      for (let j = 0; j < res.body.cineplexes[i].cinemas.length; j++) {
        cine_list.push({
          id: res.body.cineplexes[i].cinemas[j].id,
          name: res.body.cineplexes[i].cinemas[j].name,
          latitude: res.body.cineplexes[i].cinemas[j].location.latitude,
          longitude: res.body.cineplexes[i].cinemas[j].location.longitude,
        })
      }
    }
    // console.log(cine_list)
    return cine_list;
  }

  async crawlMoveekId() {
    const res = await https.get("https://moveek.com/lich-chieu/")
    const ele = parser.parseFromString(res.text, "text/html");
    const dom = new JSDOM(ele.rawHTML);
    var movie_list = [];
    let count = 0
    while(1) {
      if (dom.window.document.getElementsByTagName('select')[0][count] == undefined) {
        break;
      }
      movie_list.push({
        moveek_id: dom.window.document.getElementsByTagName('select')[0][count].getAttribute('value'),
        name: dom.window.document.getElementsByTagName('select')[0][count].innerHTML
      })
      count= count+1;
    }
    console.log(movie_list)
    return movie_list;
  }
}

class Cinema {
  suggestShowTime(latitude, longitude, moveek_id, date) {
    var crawler = new Crawler();
    var distances = [];
    var nearest_cinemas = [];
    var suggest_list = [];
    const time = new Date().toLocaleTimeString().slice(0, 5);
    //find all cinemas which display this movie
    crawler.crawlCineFromMovie(moveek_id, date)
      .then((cine_list) => {
        for (let i = 0; i < cine_list.length; i++) {
          distances.push({
            id: cine_list[i].id,
            name: cine_list[i].name,
            distance: Math.sqrt(Math.pow(cine_list[i].latitude - latitude, 2) + Math.pow(cine_list[i].longitude - longitude, 2)),
          })
        }
        distances.sort((a, b) => {
          return a.distance - b.distance
        })
        nearest_cinemas = distances.slice(0, 5)
      })
      .then(async () => {
        //find showtime for those nearest cinemas
        for (var i = 0; i < nearest_cinemas.length; i++) {
          await crawler.crawlMovieShowtimeFromCine(15184, nearest_cinemas[i].id, 2018 - 12 - 16)
            .then(result => {
              var result_after = []
              for (var i = 0; i < result.length; i++) {
                if (result_after.length == 2) {
                  break;
                }
                //compare showtime and time now
                if (result[i].localeCompare(time) == 1) {
                  result_after.push(result[i])
                }
              }
              return result_after;
            })
            .then(result_after => {
              if (result_after.length != 0) {
                suggest_list.push({
                  id: nearest_cinemas[i].id,
                  name: nearest_cinemas[i].name,
                  distance: nearest_cinemas[i].distance,
                  showtime: result_after,
                })
              }
            })
            .catch(err => {
              console.log(err)
            })
        }
        console.log(time)
        console.log(suggest_list)
        return suggest_list
      })
      .catch((err) => {
        console.log(err)
      })
  }
}

var crawler = new Crawler()
// crawler.crawlCineFromMovie(15184,'2018-12-16')
var cinema = new Cinema()
crawler.crawlMoveekId()
// cinema.suggestShowTime(21.0447802, 105.7839336, 15184, '2018-12-21')
// crawler.crawlCineFromMovie(15184, 2018 - 12 - 18)

app.listen(port, () => console.log("Easy Event listening on port", port));