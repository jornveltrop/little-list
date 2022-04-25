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
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()
const port = process.env.PORT || 8000
const secret = process.env.SECRET
require('./auth')

function isLoggedIn(req, res, next) {
  req.user ? next() : res.render("login", { layout: "mainNotLogged"});
}

//API 
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)



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


//SOCKET
io.on('connection', (socket) => {
  console.log('a user connected')

  socket.on('joinRoom', (room) => {
    socket.join(room);
  });

  socket.on('item', (item) => {
    console.log(item)

    // let insert = { url: 'someValue', naam: 'otherValue', list_items: 'otherValue' }
    //   addItem(insert)
    url = item.room

    getItems(url).then(data => {
      let items = data.body[0].list_items
      console.log(items)
    })

    async function updateItem (insert) {
      const { data, error } = await supabase
      .from('lists')
      .insert([ insert,])
    }

    io.to(item.room).emit('item', item.value)
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

//ROUTES
app.get("/", isLoggedIn, (req, res) => {
  let user = req.user.email
  let photoURL = req.user.photos[0].value
  
  addUserDB(user)

  getUrlArray(user).then(data => {
    let lists = data.body[0].lists
    console.log(lists)
    res.render("dashboard", {user: req.user, photo: photoURL, lists})
  })
})

app.post("/", (req, res) => {
  let url = randomUrl()
  console.log(req.user.email)
  let user = req.user.email

  getUrlArray(user).then(data => {
    let lists = data.body[0].lists
    lists.push(url)

    return lists
  }).then ( lists => {
    addUrlToUser(user, lists)
  })  

  res.redirect(`/${url}`)
})

app.get("/logout", (req, res) => {
  req.logout();
  req.session.destroy();
  res.redirect('/')
})

app.get('/:id', isLoggedIn, (req,res) => {
  let url = req.params.id
  let photoURL = req.user.photos[0].value

  let insert = { "url": url, "email": req.user.email }
  addList(insert)

  getItems(url).then(data => {
    let items = data.body[0].list_items
    console.log(items)
    // items.forEach(item => {
    //   console.log(item.naam)
    // });
    res.render("list", {user: req.user, photo: photoURL, url, items})
  })

});




app.get("/auth/google", 
  passport.authenticate('google', { scope: ['email', 'profile']})
)

app.get("/google/callback", 
  passport.authenticate('google', {
    successRedirect: '/',
    failureRedirect: '/auth/failure',
  })
)

app.get("/auth/failure", (req, res) => {
  res.send('Something went wrong')
})

app.get("/securedVB", isLoggedIn, (req, res) => {
  console.log(req.user)
  res.render("dashboard", {user: req.user})
})

http.listen(port, () => {
  console.log('listening on port ', port)
})




async function addList (insert) {
  const { data, error } = await supabase
  .from('lists')
  .insert([ insert,])
}

function randomUrl() {
  let urlHash = Math.random().toString(36).substring(7);
  return urlHash
}

async function addUserDB (user) {
  console.log(user)
  const { data, error } = await supabase
  .from('profiles')
  .insert([
    { email:  user},
  ])
}

async function getUrlArray(user) {
  let array = await supabase
  .from('profiles')
  .select("lists")
  .eq('email', user)

  return array
}

async function addUrlToUser(user, data) {
  let addUrlToUser = await supabase
  .from('profiles')
  .update({ "lists": data })
  .eq('email', user)
}

async function getItems(url) {
  let array = await supabase
  .from('lists')
  .select("list_items")
  .eq('url', url)

  return array
}