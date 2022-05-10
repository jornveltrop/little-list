let socket = io()
let itemList = document.querySelector('form fieldset section')
let textInput = document.querySelector('input[type="text"]')

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

// Add event listeners to items for checked/unchecked
function setEventListeners() {
  let inputs = document.querySelectorAll('input[type="checkbox"]')

  inputs.forEach(input => {
    input.addEventListener("change", _event => {
      item = {value: input.id, room: room}
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

// When server sends item
socket.on('item', item => {
  // Make new li
  let li = document.createElement('li')

  // Make new input
  let input = document.createElement('input')
      input.id = item;
      input.type = "checkbox";
      
  // Make new label
  let label = document.createElement('label')
      label.textContent = item;
      label.htmlFor = item;
      label.setAttribute("data-content", item);

  // Add input & label to li
  li.appendChild(Object.assign(input))
  li.appendChild(Object.assign(label))

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