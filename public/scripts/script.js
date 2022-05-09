let socket = io()
let itemList = document.querySelector('form fieldset section')
let textInput = document.querySelector('input[type="text"]')

let room = window.location.href.substring(window.location.href.lastIndexOf("/") + 1)

socket.emit('joinRoom', room);

if (document.querySelector('.addItemForm')) {
  document.querySelector('.addItemForm').addEventListener('submit', event => {
    event.preventDefault()
    if (textInput.value) {
      socket.emit('item', {value: textInput.value, room: room})
      textInput.value = ''
    }
  })
} 

// Add event listener.
function setEventListeners() {
  let inputs = document.querySelectorAll('input[type="checkbox"]')
  inputs.forEach(input => {
    input.addEventListener("change", _event => {
      item = {value: input.id, room: room}
      if (input.checked) {
        socket.emit("checked", item)
      } else {
        socket.emit("unchecked", item)
      }
    })
  })
}

setEventListeners();

//client side code:
socket.on('roomSize', (roomSize) => {
  console.log(roomSize)
});

socket.on('item', item => {
  console.log(item)
  let html = document.createElement('li')

  let input = document.createElement('input')
      input.id = item;
      input.type = "checkbox";
      

  let label = document.createElement('label')
      label.textContent = item;
      label.htmlFor = item;
      label.setAttribute("data-content", item);

  html.appendChild(Object.assign(input))
  html.appendChild(Object.assign(label))

  itemList.insertAdjacentElement('beforebegin', html)

  itemList.scrollTop = itemList.scrollHeight

  // Add event listener.
  let createdItem = document.querySelector(`#${item}`)
  createdItem.addEventListener("change", _event => {
    if (createdItem.checked) {
      socket.emit("checked", {value: createdItem.id, room: room})
    } else {
      socket.emit("unchecked", {value: createdItem.id, room: room})
    }
  })
})

socket.on("checked", item => {
  console.log(item + " is checked (client-side).")
  let changedItem = document.querySelector(`#${item}`)

  if (!changedItem.checked) {
    changedItem.checked = true;
  }
})

socket.on("unchecked", item => {
  console.log(item + " is unchecked (client-side).")
  let changedItem = document.querySelector(`#${item}`)

  if (changedItem.checked) {
    changedItem.checked = false;
  }
})