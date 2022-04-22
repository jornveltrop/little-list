/*
https://socket.io/get-started/chat
Auth
https://www.youtube.com/watch?v=Q0a0594tOrc

ROOMS
https://stackoverflow.com/questions/71037062/create-a-sharable-url-for-a-room-nodejs-socketio
https://gist.github.com/crtr0/2896891
*/

const express = require('express')
const app = express()
const handlebars  = require('express-handlebars')
const http = require('http').createServer(app)
const session = require('express-session')
const io = require('socket.io')(http)
const passport = require('passport');
require('dotenv').config()
const port = process.env.PORT || 8000
const secret = process.env.SECRET
require('./auth')

function isLoggedIn(req, res, next) {
  req.user ? next() : res.render("unauthorized");
}

// Render static files.
app.use(express.static("public"))

// Set the view engine to Handlebars, import the helpers and change the filename extension.
app.engine("hbs", handlebars.engine({ helpers: require("./helpers"), extname: ".hbs" }))
app.set("view engine", "hbs")

app.use(session({ 
    secret: secret
}))

// Parse incoming requests.
app.use(express.urlencoded({ extended: true }))

app.use(passport.initialize());
app.use(passport.session());

//ROUTES
app.get("/", (req, res) => {
    res.render("index")
})

app.get("/auth/google", 
  passport.authenticate('google', { scope: ['email', 'profile']})
)

app.get("/google/callback", 
  passport.authenticate('google', {
    successRedirect: '/list',
    failureRedirect: '/auth/failure',
  })
)

app.get("/auth/failure", (req, res) => {
  res.send('Something went wrong')
})

app.get("/list", isLoggedIn, (req, res) => {
  console.log(req.user)
  res.render("list", {user: req.user})
})

app.get('/list/:id', (req,res) => {
  res.render("list", {user: req.user})

  io.on('connection', (socket) => {
    console.log('a user connected')

    //
    socket.on('listRoom', data => {
      socket.room = data.room;
      console.log(socket.room)
      socket.join(data.room);
    });

    socket.on('item', (item) => {
      console.log(item)
      io.sockets.in(item.room).emit('item', {item: item.value})
    })
  
    socket.on('disconnect', () => {
      console.log('user disconnected')
    })
  
    socket.on("checked", (item) => {
      console.log(item + " is checked (server-side).")
      io.emit("checked", item)
    })
  
    socket.on("unchecked", (item) => {
      console.log(item + " is unchecked (server-side).")
      io.emit("unchecked", item)
    })

  })

  console.log(io.sockets.adapter.rooms)

});

app.get("/logout", (req, res) => {
  req.logout();
  req.session.destroy();
  res.redirect('/')
})



http.listen(port, () => {
  console.log('listening on port ', port)
})
