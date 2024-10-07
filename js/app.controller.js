import { utilService } from './services/util.service.js'
import { locService } from './services/loc.service.js'
import { mapService } from './services/map.service.js'

window.onload = onInit
var gUserPos
// To make things easier in this project structure
// functions that are called from DOM are defined on a global app object
window.app = {
    onRemoveLoc,
    onUpdateLoc,
    onSelectLoc,
    onPanToUserPos,
    onSearchAddress,
    onCopyLoc,
    onShareLoc,
    onSetSortBy,
    onSetFilterBy,
    onSave,
}

function onInit() {
    loadAndRenderLocs()

    mapService
        .initMap()
        .then(() => {
            // onPanToTokyo()
            mapService.addClickListener(openModal)
        })
        .catch((err) => {
            console.error('OOPs:', err)
            flashMsg('Cannot init map')
        })
}

function renderLocs(locs) {
    const selectedLocId = getLocIdFromQueryParams()
    // console.log('locs:', locs)
    var strHTML = locs
        .map((loc) => {
            let distance
            if (gUserPos) {
                const latlng = { lat: loc.geo.lat, lng: loc.geo.lng }
                distance = utilService.getDistance(latlng, gUserPos)
            }
            const className = loc.id === selectedLocId ? 'active' : ''
            let strHTML = `
        <li class="loc ${className}" data-id="${loc.id}">
            <h4>  
                <span>${loc.name}</span>`
            if (distance) {
                strHTML += `<span>distance: ${distance}km</span>`
            }
            strHTML += `
                <span title="${loc.rate} stars">${'★'.repeat(loc.rate)}</span>
            </h4>
            <p class="muted">
                Created: ${utilService.elapsedTime(loc.createdAt)}
                ${loc.createdAt !== loc.updatedAt ? ` | Updated: ${utilService.elapsedTime(loc.updatedAt)}` : ''}
            </p>
            <div class="loc-btns">     
               <button title="Delete" onclick="app.onRemoveLoc('${loc.id}')">🗑️</button>
               <button title="Edit" onclick="app.onUpdateLoc('${loc.id}')">✏️</button>
               <button title="Select" onclick="app.onSelectLoc('${loc.id}')">🗺️</button>
            </div>     
        </li>`
            return strHTML
        })
        .join('')
    const elLocList = document.querySelector('.loc-list')
    elLocList.innerHTML = strHTML || 'No locs to show'

    renderLocStats()

    if (selectedLocId) {
        const selectedLoc = locs.find((loc) => loc.id === selectedLocId)
        displayLoc(selectedLoc)
    }
    document.querySelector('.debug').innerText = JSON.stringify(locs, null, 2)
}

function onRemoveLoc(locId) {
    locService
        .getById(locId)
        .then((location) => {
            return confirm(`you sure you want to delete ${location.name}`)
        })
        .then((isConfirm) => {
            if (isConfirm) {
                locService
                    .remove(locId)
                    .then(() => {
                        flashMsg('Location removed')
                        unDisplayLoc()
                        loadAndRenderLocs()
                    })
                    .catch((err) => {
                        console.error('OOPs:', err)
                        flashMsg('Cannot remove location')
                    })
            }
        })

    // const confirm = confirm('you sure you want to delete')
}

function onSearchAddress(ev) {
    ev.preventDefault()
    const el = document.querySelector('[name=address]')
    mapService
        .lookupAddressGeo(el.value)
        .then((geo) => {
            mapService.panTo(geo)
        })
        .catch((err) => {
            console.error('OOPs:', err)
            flashMsg('Cannot lookup address')
        })
}

function openModal({geo, name}) {
    console.log(geo)
    document.querySelector('.modal').dataset.geo = JSON.stringify(geo, null, 2)
    document.querySelector('.loc-input').value = name || 'Select Place Name'
    document.querySelector('.modal').showModal()
}

function onSave() {
    const locName = document.querySelector('.loc-input').value
    if (!locName) return
    let loc = {
        name: locName,
        rate: document.getElementById('rangeValue').innerHTML,
        geo : JSON.parse(document.querySelector('.modal').dataset.geo),
    }

    if(document.querySelector('.modal').dataset.id){
        loc.id = document.querySelector('.modal').dataset.id
        delete document.querySelector('.modal').dataset.id
    }

    console.log(loc)
    document.querySelector('.modal').close()
    locService
        .save(loc)
        .then((savedLoc) => {
            flashMsg(`Added Location (id: ${savedLoc.id})`)
            utilService.updateQueryParams({ locId: savedLoc.id })
            loadAndRenderLocs()
        })
        .catch((err) => {
            console.error('OOPs:', err)
            flashMsg('Cannot add location')
        })
}

function onUpdateLoc(locId) {
    locService.getById(locId).then((loc) => {
        openModal(loc)
        document.querySelector('.modal').dataset.id = locId
    })
}

function loadAndRenderLocs() {
    locService
        .query()
        .then(renderLocs)
        .catch((err) => {
            console.error('OOPs:', err)
            flashMsg('Cannot load locations')
        })
}

function onPanToUserPos() {
    mapService
        .getUserPosition()
        .then((latLng) => {
            gUserPos = { lat: latLng.lat, lng: latLng.lng }
            mapService.panTo({ ...latLng, zoom: 15 })
            unDisplayLoc()
            loadAndRenderLocs()
            flashMsg(`You are at Latitude: ${latLng.lat} Longitude: ${latLng.lng}`)
        })
        .catch((err) => {
            console.error('OOPs:', err)
            flashMsg('Cannot get your position')
        })
}

function onSelectLoc(locId) {
    return locService
        .getById(locId)
        .then(displayLoc)
        .catch((err) => {
            console.error('OOPs:', err)
            flashMsg('Cannot display this location')
        })
}

function displayLoc(loc) {
    document.querySelector('.loc.active')?.classList?.remove('active')
    document.querySelector(`.loc[data-id="${loc.id}"]`).classList.add('active')

    mapService.panTo(loc.geo)
    mapService.setMarker(loc)

    const el = document.querySelector('.selected-loc')
    el.querySelector('.loc-name').innerText = loc.name
    el.querySelector('.loc-address').innerText = loc.geo.address
    el.querySelector('.loc-rate').innerHTML = '★'.repeat(loc.rate)
    el.querySelector('[name=loc-copier]').value = window.location
    const elLocDistance = document.querySelector('.loc-distance')

    if (gUserPos) {
        elLocDistance.classList.remove('hidden')
        const latlng = { lat: loc.geo.lat, lng: loc.geo.lng }
        const distance = utilService.getDistance(latlng, gUserPos)
        elLocDistance.innerHTML = `distance: ${distance}km`
    } else {
        elLocDistance.classList.add('hidden')
    }

    el.classList.add('show')

    utilService.updateQueryParams({ locId: loc.id })
}

function unDisplayLoc() {
    utilService.updateQueryParams({ locId: '' })
    document.querySelector('.selected-loc').classList.remove('show')
    mapService.setMarker(null)
}

function onCopyLoc() {
    const elCopy = document.querySelector('[name=loc-copier]')
    elCopy.select()
    elCopy.setSelectionRange(0, 99999) // For mobile devices
    navigator.clipboard.writeText(elCopy.value)
    flashMsg('Link copied, ready to paste')
}

function onShareLoc() {
    const url = document.querySelector('[name=loc-copier]').value

    // title and text not respected by any app (e.g. whatsapp)
    const data = {
        title: 'Cool location',
        text: 'Check out this location',
        url,
    }
    navigator.share(data)
}

function flashMsg(msg) {
    const el = document.querySelector('.user-msg')
    el.innerText = msg
    el.classList.add('open')
    setTimeout(() => {
        el.classList.remove('open')
    }, 3000)
}

function getLocIdFromQueryParams() {
    const queryParams = new URLSearchParams(window.location.search)
    const locId = queryParams.get('locId')
    return locId
}

function onSetSortBy() {
    const prop = document.querySelector('.sort-by').value
    const isDesc = document.querySelector('.sort-desc').checked

    if (!prop) return

    const sortBy = {}
    sortBy[prop] = isDesc ? -1 : 1

    // Shorter Syntax:
    // const sortBy = {
    //     [prop] : (isDesc)? -1 : 1
    // }

    locService.setSortBy(sortBy)
    loadAndRenderLocs()
}

function onSetFilterBy({ txt, minRate }) {
    const filterBy = locService.setFilterBy({ txt, minRate: +minRate })
    utilService.updateQueryParams(filterBy)
    loadAndRenderLocs()
}

function renderLocStats() {
    locService.getLocCountByRateMap().then((stats) => {
        console.log('stats:', stats)
        handleStats(stats, 'loc-stats-rate')
    })
    locService.getLocCountByLastUpdatedMap().then((stats) => {
        console.log('stats:', stats)
        handleStats(stats, 'loc-stats-lastUpdated')
    })
}

function handleStats(stats, selector) {
    // stats = { low: 37, medium: 11, high: 100, total: 148 }
    // stats = { low: 5, medium: 5, high: 5, baba: 55, mama: 30, total: 100 }
    const labels = cleanStats(stats)
    const colors = utilService.getColors()

    var sumPercent = 0
    var colorsStr = `${colors[0]} ${0}%, `
    labels.forEach((label, idx) => {
        if (idx === labels.length - 1) return
        const count = stats[label]
        const percent = Math.round((count / stats.total) * 100, 2)
        sumPercent += percent
        colorsStr += `${colors[idx]} ${sumPercent}%, `
        if (idx < labels.length - 1) {
            colorsStr += `${colors[idx + 1]} ${sumPercent}%, `
        }
    })

    colorsStr += `${colors[labels.length - 1]} ${100}%`
    // Example:
    // colorsStr = `purple 0%, purple 33%, blue 33%, blue 67%, red 67%, red 100%`

    const elPie = document.querySelector(`.${selector} .pie`)
    const style = `background-image: conic-gradient(${colorsStr})`
    elPie.style = style

    const ledendHTML = labels
        .map((label, idx) => {
            return `
                <li>
                    <span class="pie-label" style="background-color:${colors[idx]}"></span>
                    ${label} (${stats[label]})
                </li>
            `
        })
        .join('')

    const elLegend = document.querySelector(`.${selector} .legend`)
    elLegend.innerHTML = ledendHTML
}

function cleanStats(stats) {
    const cleanedStats = Object.keys(stats).reduce((acc, label) => {
        if (label !== 'total' && stats[label]) {
            acc.push(label)
        }
        return acc
    }, [])
    return cleanedStats
}
