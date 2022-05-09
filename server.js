/*
https://socket.io/get-started/chat
Auth
https://www.youtube.com/watch?v=Q0a0594tOrc

ROOMS
https://stackoverflow.com/questions/71037062/create-a-sharable-url-for-a-room-nodejs-socketio
https://gist.github.com/crtr0/2896891
*/

require('dotenv').config()
require('./auth')

const express = require('express')
const app = express()
const handlebars  = require('express-handlebars')
const http = require('http').createServer(app)
const session = require('express-session')
const io = require('socket.io')(http)
const passport = require('passport');
const { createClient } = require('@supabase/supabase-js')
const port = process.env.PORT || 8000
const secret = process.env.SECRET


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

    io.to(item.room).emit('item', item.value)
    let url = item.room

    getItems(url).then(data => {
      let items = data.body[0].list_items || []

      let newItem = {
        "naam": item.value,
        "checked": false
      }

      items.push(newItem)
      return items
    })
    .then(items => {
      updateItem(url, items)
    })

  })

  socket.on('disconnect', () => {
    console.log('user disconnected')
  })

  socket.on("checked", (item) => {
    console.log(item.value + " is checked (server-side).")
    io.to(item.room).emit("checked", item.value)

    let url = item.room
    getItems(url).then(data => {
      let items = data.body[0].list_items
      let filteredItem = filterItem(items, item) 
      
      //Change checked state to true
      filteredItem.checked = true
      
      return items
    }).then(items => {
      console.log(items)
      updateItem(url, items)
    })
  })

  socket.on("unchecked", (item) => {
    console.log(item.value + " is unchecked (server-side).")
    io.to(item.room).emit("unchecked", item.value)

    let url = item.room
    getItems(url).then(data => {
      let items = data.body[0].list_items
      let filteredItem = filterItem(items, item) 
      
      //Change checked state to true
      filteredItem.checked = false

      return items
    }).then(items => {
      updateItem(url, items)
    })
  })


})

//ROUTES
app.get("/", isLoggedIn, (req, res) => {
  let userMail = req.user.email
  let photoURL = req.user.photos[0].value

  addUserDB(userMail)

  getUrlArray(userMail).then(data => {

    let lists = data.body[0].lists

    res.render("dashboard", {user: req.user, photo: photoURL, lists})
  })
})

app.post("/", (req, res) => {
  let url = randomUrl()

  let userMail = req.user.email

  getUrlArray(userMail).then(data => {
    let lists = data.body[0].lists
    lists.push(url)

    return lists
  }).then ( lists => {
    addUrlToUser(userMail, lists)
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
    let items
    if (data.body[0] != undefined) {
      items = data.body[0].list_items
    } else {
      items = []
    }
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

async function addUserDB (userMail) {
  const { data, error } = await supabase
    .from('profiles')
    .insert([
      { email:  userMail},
    ])
}

async function getUrlArray(userMail) {
  let array = await supabase
    .from('profiles')
    .select("lists")
    .eq('email', userMail)

  return array
}

async function addUrlToUser(userMail, data) {
  let addUrlToUser = await supabase
    .from('profiles')
    .update({ "lists": data })
    .eq('email', userMail)
}

async function getItems(url) {
  let array = await supabase
    .from('lists')
    .select("list_items")
    .eq('url', url)

  return array
}

async function updateItem (url, insert) {
  const { data, error } = await supabase
    .from('lists')
    .update({ list_items: insert })
    .eq('url', url)
}

function filterItem(list, item){
  let selectedItem = list.find(listItem => {
    return listItem.naam === item.value
  })

  return selectedItem
}