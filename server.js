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

// Check if user is logged in
function isLoggedIn(req, res, next) {
  req.user ? next() : res.render("login", { layout: "mainNotLogged"});
}

// API 
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

// Render static files.
app.use(express.static("public"))

// Set the view engine to Handlebars, import the helpers and change the filename extension.
app.engine("hbs", handlebars.engine({ helpers: require("./helpers"), extname: ".hbs" }))
app.set("view engine", "hbs")

// Set-up session
app.use(session({ 
    secret: secret
}))

// Parse incoming requests.
app.use(express.urlencoded({
  extended: true
}));

// Set-up passport
app.use(passport.initialize());
app.use(passport.session());


// SOCKET
io.on('connection', (socket) => {
  console.log('a user connected')

  socket.on('joinRoom', (room) => {
    socket.join(room);
  });

  socket.on('item', (item) => {

    // Send item to all clients in specific room
    io.to(item.room).emit('item', item.value)
    let url = item.room

    // Get current room items from database
    getItems(url).then(data => {
      let items = data.body[0].list_items || []

      // Make new item
      let newItem = {
        "naam": item.value,
        "checked": false
      }

      // Push new item to current list items
      items.push(newItem)
      return items
    })
    .then(items => {
      // Send updated list to database
      updateItem(url, items)
    })
  })

  socket.on('disconnect', () => {
    console.log('user disconnected')
  })

  socket.on("checked", (item) => {
    console.log(item.value + " is checked (server-side).")

    // Send checked value to all clients in specific room
    io.to(item.room).emit("checked", item.value)

    // Get current room items from database
    let url = item.room
    getItems(url).then(data => {
      let items = data.body[0].list_items || []

      // Get specific changed item from database data
      let filteredItem = filterItem(items, item) 
      
      // Change checked state to true
      filteredItem.checked = true
      
      return items
    }).then(items => {
      // Send changed list back to database
      updateItem(url, items)
    })
  })

  socket.on("unchecked", (item) => {
    console.log(item.value + " is unchecked (server-side).")

    // Send unchecked value to all clients in specific room
    io.to(item.room).emit("unchecked", item.value)

    // Get current room items from database
    let url = item.room
    getItems(url).then(data => {
      let items = data.body[0].list_items || []

      // Get specific changed item from database data
      let filteredItem = filterItem(items, item) 
      
      // Change checked state to false
      filteredItem.checked = false

      return items
    }).then(items => {
      // Send changed list back to database
      updateItem(url, items)
    })
  })

  socket.on("removeItem", (item) => {
    console.log(item.value + " is clicked to remove (server-side).")

    // Send removed item to all clients in specific room
    io.to(item.room).emit("removeItem", item.value)

    // Get current room items from database
    let url = item.room
    getItems(url).then(data => {
      let items = data.body[0].list_items || []

      // Get specific changed item from database data
      let filteredItem = items.filter( i => { return i.naam !== item.value })

      return filteredItem
    }).then(filteredItem => {
      // Send changed list back to database
      updateItem(url, filteredItem)
    })
  })
})

// ROUTES
app.get("/", isLoggedIn, (req, res) => {
  let userMail = req.user.email
  let photoURL = req.user.photos[0].value

  addUserDB(userMail)

  // Get all lists from logged in user
  getUrlArray(userMail).then(data => {

    let lists = data.body[0].lists || []

    res.render("dashboard", {user: req.user, photo: photoURL, lists})
  })
})

// New list
app.post("/", (req, res) => {
  // Make random URL
  let url = randomUrl()

  let userMail = req.user.email

  // Get all lists from logged in user
  getUrlArray(userMail).then(data => {
    let lists = data.body[0].lists || []

    // Make new item
    let newList = {
      "url": url,
      "naam": null
    }
    // Add new list to array
    lists.push(newList)

    return lists
  }).then ( lists => {
    // Send updated list array to profile database table
    addUrlToUser(userMail, lists)
  })  

  // Redirect user to new list
  res.redirect(`/${url}`)
})

// Log user out and redirect to login page
app.get("/logout", (req, res) => {
  req.logout();
  req.session.destroy();
  res.redirect('/')
})

// List route
app.get('/:id', isLoggedIn, (req,res) => {
  let url = req.params.id
  let photoURL = req.user.photos[0].value

  // Add list to list database table
  let insert = { "url": url, "email": req.user.email }
  addList(insert)

  // Get items from list 
  getItems(url).then(data => {
    let items
    
    // If there are items, fill variable with those items
    if (data.body[0] != undefined) {
      items = data.body[0].list_items
    } else {
      // If there are no items, set empty array
      items = []
    }

    // Get the name of list
    getNameList(url).then(data => {
      let nameList = data.body[0].naam

      res.render("list", {user: req.user, photo: photoURL, url, items, nameList})
    })
  })

});

app.post("/:id", (req, res) => {
  let url = req.params.id
  let title = req.body.title;

  // Send updated title to database
  updateNameList(url, title)

  let userMail = req.user.email

  // Get all lists from logged in user
  getUrlArray(userMail).then(data => {
    let lists = data.body[0].lists || []

    // Get specific changed item from database data
    let filteredItem = filterList(lists, url) 
    
    // Change checked state to false
    filteredItem.naam = title

    return lists
  }).then(lists => {
    // Send changed list back to database
    updateUrlArray(userMail, lists)
  })

  // Redirect user to new list
  res.redirect(`/${url}`)
})

// Authenticate route for Google
app.get("/auth/google", 
  passport.authenticate('google', { scope: ['email', 'profile']})
)
// Authenticate route back for Google
app.get("/google/callback", 
  passport.authenticate('google', {
    successRedirect: '/',
    failureRedirect: '/auth/failure',
  })
)

// Authenticate failure route for Google
app.get("/auth/failure", (req, res) => {
  res.send('Something went wrong')
})

// Server
http.listen(port, () => {
  console.log('listening on port ', port)
})



// Add list to database list table
async function addList (insert) {
  const { data, error } = await supabase
    .from('lists')
    .insert([ insert,])
}

// Generate random URL hash
function randomUrl() {
  let urlHash = Math.random().toString(36).substring(7);
  return urlHash
}

// Add user to database profiles table
async function addUserDB (userMail) {
  let addUserDB = await supabase
    .from('profiles')
    .insert([
      { email:  userMail},
    ])
}

// Get all lists of user from database profiles table
async function getUrlArray(userMail) {
  let array = await supabase
    .from('profiles')
    .select("lists")
    .eq('email', userMail)

  return array
}

//Update list array of user
async function updateUrlArray (userMail, insert) {
  let updateItem = await supabase
    .from('profiles')
    .update({ lists: insert })
    .eq('email', userMail)
}

// Add url to profile of user in database profiles table
async function addUrlToUser(userMail, data) {
  let addUrlToUser = await supabase
    .from('profiles')
    .update({ "lists": data })
    .eq('email', userMail)
}

// Get list items from specific list/url
async function getItems(url) {
  let array = await supabase
    .from('lists')
    .select("list_items")
    .eq('url', url)

  return array
}

// Get list items from specific list/url
async function getNameList(url) {
  let naam = await supabase
    .from('lists')
    .select('naam')
    .eq('url', url)

  return naam
}

// Update item in specific list/url
async function updateItem (url, insert) {
  let updateItem = await supabase
    .from('lists')
    .update({ list_items: insert })
    .eq('url', url)
}

// Update name of list
async function updateNameList (url, insert) {
  let updateNameList = await supabase
    .from('lists')
    .update({ 'naam': insert })
    .eq('url', url)
}

// Filter certain item from specific list/url
function filterItem(list, item){
  let selectedItem = list.find(listItem => {
    return listItem.naam === item.value
  })

  return selectedItem
}

// Get specific item from list
function filterList(lists, list){
  let selectedItem = lists.find(listItem => {
    return listItem.url === list
  })

  return selectedItem
}