let socket = io()
let itemList = document.querySelector('form fieldset section')
let textInput = document.querySelector('#addItem')

// Get url hash (same as room id)
let room = window.location.href.substring(window.location.href.lastIndexOf("/") + 1)

// Join room on url hash
socket.emit('joinRoom', room);

if (document.querySelector('.addItemForm')) {
  document.querySelector('.addItemForm').addEventListener('submit', event => {
    event.preventDefault()
    
    // Send item to server
    if (textInput.value) {
      socket.emit('item', {value: textInput.value, room: room})
      // Reset text input to empty
      textInput.value = ''
    }
  })
} 

// Add event listeners to items for checked/unchecked & edit/remove buttons
function setEventListeners() {
  let inputs = document.querySelectorAll('input[type="checkbox"]')
  let editListNameButton = document.querySelector('.editListName')
  let trashCans = document.querySelectorAll('.addItemForm li a')
  let shareSpace = document.querySelector('.share span')

  if (editListNameButton) {
    editListNameButton.addEventListener("click", editListName)
  }

  trashCans.forEach(trash => {
      trash.addEventListener("click", removeItem)
  });

  shareSpace.addEventListener("click", copyClipboard)

  inputs.forEach(input => {
    input.addEventListener("change", _event => {
      let item = {value: input.id, room: room}
      if (input.checked) {
        // Send item if checked to server
        socket.emit("checked", item)
      } else {
        // Send item if unchecked to server
        socket.emit("unchecked", item)
      }
    })
  })
}

setEventListeners();

// Send removed item to server
function removeItem() {
  let value = this.getAttribute('item')
  let item = {value: value, room: room}
  socket.emit("removeItem", item)
}

// Change list name
function editListName() {
  let listNameForm = document.querySelector('.title > form')
  let listName = document.querySelector('.title > div')
  let listNameH2 = document.querySelector('.title > div h2')
  let listNameFormInput = document.querySelector('.title > form input')

  listNameFormInput.value = listNameH2.textContent
  listNameForm.classList.remove('none')
  listName.classList.add('none')
}

// Copy to clipboard
function copyClipboard() {
  let share = document.querySelector('.share input')

  share.select();
  navigator.clipboard.writeText(share.value);

  setAnimatieCopy()
  setTimeout(removeAnimatieCopy, 1000);
}

// Set animation for copy
function setAnimatieCopy() {
  let copyH4 = document.querySelector('.share h4')
  copyH4.classList.add('copyAnimatie')
}

// Remove animation for copy
function removeAnimatieCopy() {
  let copyH4 = document.querySelector('.share h4')
  copyH4.classList.remove('copyAnimatie')
}


// When server sends item
socket.on('item', item => {
  // Make new li
  let li = document.createElement('li')
  
  let div = document.createElement('div')
  // Make new input
  let input = document.createElement('input')
      input.id = item;
      input.type = "checkbox";
      
  // Make new label
  let label = document.createElement('label')
      label.textContent = item;
      label.htmlFor = item;
      label.setAttribute("data-content", item);


  let a = document.createElement('a')
      a.setAttribute("item", item);
      a.addEventListener("click", removeItem)

  let img = document.createElement('img')
      img.src = "/images/trash.svg"

  // Add input & label to li
  div.appendChild(Object.assign(input))
  div.appendChild(Object.assign(label))

  a.appendChild(Object.assign(img))

  li.appendChild(Object.assign(div))
  li.appendChild(Object.assign(a))

  // Add li to itemList in html
  itemList.insertAdjacentElement('beforebegin', li)

  // Scroll along
  itemList.scrollTop = itemList.scrollHeight

  // Add event listener to new item for checked/unchecked
  let createdItem = document.querySelector(`#${item}`)
  createdItem.addEventListener("change", _event => {
    if (createdItem.checked) {
      // Send item if checked to server
      socket.emit("checked", {value: createdItem.id, room: room})
    } else {
      // Send item if unchecked to server
      socket.emit("unchecked", {value: createdItem.id, room: room})
    }
  })
})

// If server sends checked item set item to checked
socket.on("checked", item => {
  console.log(item + " is checked (client-side).")
  let changedItem = document.querySelector(`#${item}`)

  if (!changedItem.checked) {
    changedItem.checked = true;
  }
})

// If server sends unchecked item set item to unchecked
socket.on("unchecked", item => {
  console.log(item + " is unchecked (client-side).")
  let changedItem = document.querySelector(`#${item}`)

  if (changedItem.checked) {
    changedItem.checked = false;
  }
})

// If server sends removed item, remove item
socket.on("removeItem", item => {
  console.log(item + " is clicked to remove (client-side).")
  let removeItem = document.querySelector(`#${item}`)

  let parent = removeItem.parentElement
  parent.parentElement.remove()
})

