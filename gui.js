Vue.component('grid', {
    template: '#grid-template',
    props: {
      data: Array,
      columns: Array,
      filterKey: String
    },
    data() {
      var sortOrders = {}
      this.columns.forEach(function (key) {
          sortOrders[key] = 1
      })
      return {
        sortKey: '',
        sortOrders: sortOrders
      }
    },
    computed: {
      filteredData: function () {
        var sortKey = this.sortKey
        var filterKey = this.filterKey && this.filterKey.toLowerCase()
        var order = this.sortOrders[sortKey] || 1
        var data = this.data
        if (filterKey) {
          data = data.filter(function (row) {
            return Object.keys(row).some(function (key) {
              return String(row[key]).toLowerCase().indexOf(filterKey) > -1
            })
          })
        }
        if (sortKey) {
          data = data.slice().sort(function (a, b) {
            a = a[sortKey]
            b = b[sortKey]
            return (a === b ? 0 : a > b ? 1 : -1) * order
          })
        }
        return data
      }
    },
    filters: {
      capitalize: function (str) {
        return str.charAt(0).toUpperCase() + str.slice(1)
      }
    },
    methods: {
      sortBy: function (key) {
        this.sortKey = key
        this.sortOrders[key] = this.sortOrders[key] * -1
      }
    }
})

  
const { fork } = require('child_process')

var regexpProc
function regexpProcStart() {
    regexpProc = fork(__dirname + '/regexp.js')
    regexpProc.on('message', regexpProcMessage)
}
regexpProcStart()
function regexpProcRestart() {
    regexpProc.kill()
    regexpProcStart()
}

var regexpProcCallback
var regexpProcTimer
var regexpProcQueue = []
function regexpProcSend(data, callback) {
    if (regexpProcTimer) {
        console.log('REGEXP delayed')

        regexpProcQueue.push(arguments)
        return false
    }

    regexpProcTimer = setTimeout(() => {
        console.log('REGEXP Timeout')

        regexpProcRestart()
        regexpProcTimer = null

        regexpProcCallback({ error: 'Regexp timed out' })
    
        if (regexpProcQueue[0])
            regexpProcSend.apply(null, regexpProcQueue.pop())
    }, 3000)
    regexpProcCallback = callback

    console.log('REGEXP Send', data)
    regexpProc.send(data)

    return true
}

function regexpProcMessage(data) {
    console.log('REGEXP Receive', data)

    clearTimeout(regexpProcTimer)
    regexpProcTimer = null

    regexpProcCallback(data)

    if (regexpProcQueue[0])
        regexpProcSend.apply(null, regexpProcQueue.pop())
}

Vue.component('site', {
    template: '#site-template',
    props: ['value'],
    data() {return {
        mode: 'list',
        error: null,
        content: null,
    }},
    created() {
        this.$parent.$on('request', this.request)

        this.$watch('value.regexp', this.regexp)
        this.$watch('content', this.regexp)
    },
    methods: {
        regexp_cb(data) {
            var results = []
            if (data.result && data.result[0] && this.value.columns) {
                var columns = this.value.columns.split(',')
                for(var x = 0; x < data.result.length; ++x) {
                    var result = {}
                    for(var y = 0; y < data.result[x].length; ++y) {
                        var c = columns[y] ? columns[y] : y
                        result[c] = result[c] ? result[c] + ' ' + data.result[x][y] : data.result[x][y]
                    }
                    result = JSON.stringify(result)
                    if (!results.includes(result))
                        results.push(result)
                }
            }

            this.error = data.error
            this.value.results = results.map(r => JSON.parse(r))
        },
        regexp() {
            if (this.value.regexp)
                regexpProcSend({
                    regexp: this.value.regexp.replace(/[\r\n]/g, '[\\W\\w]+?'),
                    content: this.content,
                }, this.regexp_cb)
        },
        request_cb(j) {
            if (j.readyState == XMLHttpRequest.DONE) {
                console.log('Fetch completed', j.status, j.statusText)
                if (j.status == 200)
                    this.content += j.response
                else {
                    this.content = null
                    this.error = j.statusText
                }
            }
        },
        request() {
            this.content = ''
            this.error = null

            var urlparam = this.value.urlparam
            if (!urlparam)
                urlparam = ''
            urlparam = urlparam.split(',')

            var go
            go = () => {
                var p = urlparam.shift()
                if (p === undefined)
                    return

                console.log('Fetch starting', this.value.name, 'Parameter', p)
                var j = new XMLHttpRequest()
                j.onreadystatechange = () => {
                    this.request_cb(j)

                    if (this.error)
                        return

                    if (j.readyState == XMLHttpRequest.DONE)
                        setTimeout(go, 2000 + Math.random() * 1000)
                } 
                var method = this.value.method || 'GET'
                j.open(method, this.value.url.replace('$', p))
                if (method == 'POST')
                    j.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
                j.send(this.value.data)
            }
            go()
        },
    },
})


Vue.component('newsite', {
    template: '#newsite-template',
    data() {return {
        site: {
            name: null,
            url: null,
            urlparam: null,
            method: null,
            data: null,
            regexp: null,
            columns: null,
            expected: null,
            link: null,
            results: []
        },
    }},
    created() {
        this.reset()
    },
    methods: {
        reset() {
            this.site.name = null
            this.site.url = null
            this.site.urlparam = null
            this.site.method = null
            this.site.data = null
            this.site.regexp = null
            this.site.columns = null
            this.site.expected = null
            this.site.link = null
            this.site.results = []
        },
    },
})


var opn = require('opn')

var electron = require('electron')
var ipc = electron.ipcRenderer

Vue.filter('columns', function (value) {
    var columns = []
    value.forEach(v => columns = _.union(columns, Object.keys(v).filter(c => c[0] !== '_')))
    try {
        return _.union(_.intersection(app.$data.columnsOrder.split(','), columns), columns)
    } catch(e) { }
    return columns
})

function parse(value, min = 0) {
    if (value === null || value === undefined)
        return undefined

    if (/^[+-]?\d?\d?\d(\.?\d\d\d)*(,\d+)?$/.test(value)) {
        var v = Number.parseFloat(value.replace('.', '').replace(',', '.'))
        if (min <= v)
            return v
    }
    if(/^[+-]?\d?\d?\d(\,?\d\d\d)*(.\d+)?$/.test(value)) {
        var v = Number.parseFloat(value.replace(',', ''))
        if (min <= v)
            return v
    }
        
    console.warn('Can not parse float', value)
    return undefined
}

var app = new Vue({
    el: "#app",
    data: {
        columnsOrder: '',
        sites: [],
        changes: [],
        groupDetail: [],
        locationCache: {},
        googleApiKey: null,
    },
    created() {
        ipc.on('storeSet', this.storeSet)
        ipc.on('storeSetDone', this.storeSetDone)

        ipc.send('storeGet')

        this.$watch('columnsOrder', this.storeChanged, {deep: true})
        this.$watch('sites', this.storeChanged, {deep: true})
        this.$watch('changes', this.storeChanged, {deep: true})
        this.$watch('locationCache', this.storeChanged, {deep: true})

        this.locationCacheRefresh()
    },
    computed: {
        results() {
            var results = []
            this.changes.forEach(c => {
                var rn = Object.assign({}, c)
                delete rn.Change
                delete rn.Time
                delete rn.Committed // TODO remove

                var ro = results.find(r => r.Site === rn.Site && r.ID === rn.ID)
                if (c.Change === 'New' || c.Change === 'NewRes') {
                    if (ro === undefined)
                        results.push(rn)
                    else
                        console.warn('To be created result already exists', c)
                } else if (c.Change === 'Upd' || c.Change === 'UpdRes') {
                    if(ro !== undefined)
                        Object.assign(ro, rn)
                    else
                        console.warn('To be updated result could not be found', c)
                } else if (c.Change === 'Del' || c.Change === 'DelRes') {
                    if(ro !== undefined)
                        results.splice(results.indexOf(ro), 1)
                    else
                        console.warn('To be deleted result has already been deleted or never created', c)
                }
            })
            return results
        },
        groups() {
            function groupFromResult(r) {
                var g = Object.assign({}, r)
                delete g.Site
                delete g.ID

                if (Number.isInteger(g.Group) && g.Group > 0)
                    g.ID = g.Group
                delete g.Group             

                g.Preis = parse(g.Preis, 10000)
                g.Wohn = parse(g.Wohn, 70)
                g.Zimmer = parse(g.Zimmer, 3)
                g.Grund = parse(g.Grund, 100)

                return g
            }

            var groups = []
            var resultsNotInGroup = this.results.slice()

            var r
            while((r = resultsNotInGroup.shift()) !== undefined) {
                var g = groupFromResult(r)
                groups.push(g)

                do {
                    var groupChanged = false

                    this.groupResults(g).forEach(r => {
                        var gn = groupFromResult(r)
                        _.difference(
                            Object.keys(gn),
                            Object.keys(g)
                        ).forEach(c => {
                            g[c] = gn[c]

                            groupChanged = true
                        })
                    })
                } while(groupChanged)

                this.groupResults(g).forEach(r => {
                    var i = resultsNotInGroup.indexOf(r)
                    if (i === -1) {
                        // TODO work around?
                        i = resultsNotInGroup.findIndex(rn => r.Site === rn.Site && r.ID === rn.ID)
                        if (i !== -1)
                            console.warn('app.computed.groups', 'Same key, different instances', resultsNotInGroup[i], r)
                    }
                    if (i !== -1)
                        resultsNotInGroup.splice(i, 1)
                })
            }
            return groups
        },
        groupDetailResults() {
            var results = []            
            this.groupDetail.forEach(g => {
                this.groupResults(g).forEach(r => {
                    if (!results.includes(r)) {
                        var dr = results.find(dr => dr.Site === r.Site && dr.ID === r.ID)
                        if (dr !== undefined)
                            console.warn('app.computed.groupDetailResults', 'Same key, different instances', dr, r)
                        else
                            results.push(r)
                    }
                        
                })
            })
            return results
        },
        groupDetailChanges() {
            return this.changes.filter(c => this.groupDetailResults.find(r => c.Site === r.Site && c.ID === r.ID) !== undefined)
        },
        // changesFromActualResultsAndResultsFromCommittedChanges() {
        //     var changes = []

        //     this.results.forEach(rn => {
        //         var ros = this.results.filter(ro => ro.Site === rn.Site && ro.ID === rn.ID)
        //         if (ros.length === 0)
        //             changes.push(Object.assign({
        //                 Change: 'New'
        //             }, rn))
        //         else if(ros.length === 1) {
        //             var change = {}
        //             var equal = true

        //             var ro = ros[0]
        //             _.union(
        //                 Object.keys(rn),
        //                 Object.keys(ro)
        //             ).forEach(c => {
        //                 if (rn[c] === ro[c])
        //                     return
        //                 equal = false
        //                 change[c] = rn[c]
        //             })

        //             if (equal)
        //                 return
                        
        //             ;['Change', 'Site', 'ID'].forEach(c => {
        //                 if (change[c])
        //                     throw new Error('Not allowed property in Result: ' + c)
        //             })
        //             change.Change = 'Upd'
        //             change.Site = rn.Site
        //             change.ID = rn.ID
        //             changes.push(change)
        //         } else
        //             throw new Error('Found multiple results with Site and ID = ' + c.Site + ' and ' + c.ID)
        //     })

        //     return changes
        // },
        // compareObjectsAndObjectsFromResults() {
        //     var changes = []
        //     var ons = this.objects

        //     this.objects.forEach(oo => {
        //         var on = ons.filter(on => on.ID === oo.ID)
        //         if (on.length === 0)
        //             changes.push(Object.assign({
        //                 Change: 'Del'
        //             }, oo))
        //         else if(on.length === 1) {
        //             ons.splice(ons.indexOf(on[0]), 1)
        //             var on = _.cloneDeep(on[0])

        //             var equal = true
        //             _.union(
        //                 Object.keys(oo),
        //                 Object.keys(on)
        //             ).forEach(c => {
        //                 if (on[c] === oo[c])
        //                     return
        //                 equal = false
        //             })
        //             if (equal)
        //                 return
                        
        //             changes.push(Object.assign({
        //                 Change: 'Del'
        //             }, oo))
        //             changes.push(Object.assign({
        //                 Change: 'New'
        //             }, on))
        //         } else
        //             throw new Error('Found multiple objects with ID = ' + c.Site + ' and ' + c.ID)
        //     })

        //     ons.forEach(on => {
        //         changes.push(Object.assign({
        //             Change: 'New'
        //         }, on))
        //     })

        //     return changes
        // }
        locationGroups() {
            function locationFromResult(r) {
                var l = Object.assign({
                    ID: r.Location,
                    Ort: r.Ort
                })

                return l
            }

            var locations = []
            var resultsNotInLocation = this.results.slice()

            var r
            while((r = resultsNotInLocation.shift()) !== undefined) {
                var l = locationFromResult(r)
                locations.push(l)

                do {
                    var locationChanged = false

                    this.locationResults(l).forEach(r => {
                        var ln = locationFromResult(r)
                        _.difference(
                            Object.keys(ln),
                            Object.keys(l)
                        ).forEach(c => {
                            l[c] = ln[c]

                            locationChanged = true
                        })
                    })
                } while(locationChanged)

                this.locationResults(l).forEach(r => {
                    var i = resultsNotInLocation.indexOf(r)
                    if (i === -1) {
                        // TODO work around?
                        i = resultsNotInLocation.findIndex(rn => r.Site === rn.Site && r.ID === rn.ID)
                        if (i !== -1)
                            console.warn('app.computed.locations', 'Same key, different instances', resultsNotInLocation[i], r)
                    }
                    if (i !== -1)
                        resultsNotInLocation.splice(i, 1)
                })

                try {
                    function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {
                        var R = 6371; // Radius of the earth in km
                        var dLat = deg2rad(lat2-lat1);  // deg2rad below
                        var dLon = deg2rad(lon2-lon1); 
                        var a = 
                        Math.sin(dLat/2) * Math.sin(dLat/2) +
                        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
                        Math.sin(dLon/2) * Math.sin(dLon/2)
                        ; 
                        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
                        var d = R * c; // Distance in km
                        return d;
                    }
                    
                    function deg2rad(deg) {
                        return deg * (Math.PI/180)
                    }

                    var loc = this.locationCache[l.Ort]
                    if (loc.lat !== undefined &&
                        loc.lon !== undefined)
                        l.Distanz = getDistanceFromLatLonInKm(52.0693922,8.6026649, loc.lat, loc.lon).toFixed(1) + ' km'
                } catch(_) {}
            }
            return locations
        },
        changesUncommitted() {
            var changes = []
            
            var sites = this.sites.slice()
            var results = this.results.slice()

            sites.forEach(site => {
                if (site.results === undefined) // TODO is this needed?
                    site.results = []
                if (site.results.length === 0)
                    return

                var ros = results.filter(ro => ro.Site === site.name)

                site.results.forEach(rn => {
                    rn = Object.assign({
                        Site: site.name
                    }, rn)

                    var ro = ros.find(r => r.ID === rn.ID)
                    if (ro === undefined)
                        changes.push(Object.assign({
                            Change: 'New'
                        }, rn))
                    else {
                        ros.splice(ros.indexOf(ro), 1)

                        var change = {}
                        var equal = true

                        _.union(
                            Object.keys(rn),
                            Object.keys(ro)
                        ).forEach(c => {
                            if (c === 'Group' || c === 'Location')
                                return
                            if (rn[c] === ro[c])
                                return
                            equal = false
                            change[c] = rn[c]
                        })

                        if (equal)
                            return
                            
                        ;['Change', 'Site', 'ID'].forEach(c => {
                            if (change[c] !== undefined)
                                console.warn('Not allowed property in Change', c)
                        })
                        change.Change = 'Upd'
                        change.Site = rn.Site
                        change.ID = rn.ID
                        changes.push(change)
                    }
                })

                ros.forEach(ro => {
                    changes.push(Object.assign({
                        Change: 'Del'
                    }, ro))
                })
            })
            return changes
        },
    },
    methods: {
        groupResults(g) {
            return this.results.filter(r => {
                var rPreis = parse(r.Preis, 10000)
                var rWohn = parse(r.Wohn, 70)
                var rZimmer = parse(r.Zimmer, 3)
                var rGrund = parse(r.Grund, 100)

                return (
                    Number.isInteger(g.ID) && g.ID > 0 && g.ID === r.Group
                ) || (
                    r.Group === undefined &&
                    g.Titel.substring(0, 65) === r.Titel.substring(0, 65) &&
                    ( g.Preis === undefined ||  rPreis === undefined || g.Preis  * 0.9  < rPreis && rPreis < g.Preis * 1.1) &&
                    (  g.Wohn === undefined ||   rWohn === undefined || g.Wohn   * 0.95 < rWohn  && rWohn  < g.Wohn  * 1.05) &&
                    (g.Zimmer === undefined || rZimmer === undefined || g.Zimmer === rZimmer) &&
                    ( g.Grund === undefined ||  rGrund === undefined || g.Grund  * 0.95 < rGrund && rGrund < g.Grund * 1.05)
                )
            })
        },
        locationResults(l) {
            return this.results.filter(r => {
                return (
                    Number.isInteger(l.ID) && l.ID > 0 && l.ID === r.Location
                ) || (
                    r.Location === undefined &&
                    (
                        l.Ort === r.Ort ||
                        (
                            l.Ort && r.Ort && (
                                l.Ort.replace(/^\s*(\d+) .*$/, '$1') === r.Ort.replace(/^\s*(\d+) .*$/, '$1') ||
                                l.Ort.replace(/\s/g, '') === r.Ort.replace(/\s/g, '')
                            )
                        )
                    )
                )
            })
        },

        open(event) {
            this.sites.filter(s => s.name === event.Site).forEach(s => {
                var detail = event.ID || event._ID
                if (!detail)
                    return
                if (!detail.match(/^https?:\/\//)) {
                    if (!s.link)
                        return
                    detail = s.link.replace('$', detail)
                }
                opn(detail)
            })
        },

        groupDetailToggle(event) {
            var i = this.groupDetail.indexOf(event)
            if (i === -1)
                this.groupDetail.push(event)
            else
                this.groupDetail.splice(i, 1)
        },
        mergeGroup() {
            var gID = this.groupDetail.find(g => Number.isInteger(g.ID) && g.ID > 0)
            if (gID !== undefined)
                gID = gID.ID
            else
                for(gID = 1; this.changes.find(c => c.Group === gID) !== undefined; ++gID) {}
            
            this.groupDetailResults
                .filter(r => r.Group !== gID)
                .forEach(r => {
                    ['Change', 'Time'].forEach(c => {
                        if (r[c])
                            throw new Error('Not allowed property in Result: ' + c)
                    })
                    this.changes.push(Object.assign({
                        Change: 'Upd',
                        Time: Date.now(),
                        Site: r.Site,
                        ID: r.ID,
                        Group: gID
                    }))
                })

            this.groupDetail = this.groups.filter(g => g.ID === gID)
        },
        mergeLocation() {
            var lID = this.groupDetail.find(g => Number.isInteger(g.Location) && g.Location > 0)
            if (lID !== undefined)
                lID = lID.Location
            else
                for(lID = 1; this.changes.find(c => c.Location === lID) !== undefined; ++lID) {}
            
            this.groupDetailResults
                .filter(r => r.Location !== lID)
                .forEach(r => {
                    ['Change', 'Time'].forEach(c => {
                        if (r[c])
                            throw new Error('Not allowed property in Result: ' + c)
                    })
                    this.changes.push(Object.assign({
                        Change: 'Upd',
                        Time: Date.now(),
                        Site: r.Site,
                        ID: r.ID,
                        Location: lID
                    }))
                })
        },

        commit() {
            var changes = this.changes.slice()

            this.changesUncommitted.forEach(c => {
                if (c.ID === undefined)
                    throw new Error('Change had no ID set', c)
                if (c.Time !== undefined)
                    throw new Error('Change had timestamp set before commit')

                changes.push(Object.assign({
                    Time: Date.now()
                }, c))
            })

            this.changes = changes
        },

        locationCacheRefreshInternalCb(j, loc) {
            if (j.readyState == XMLHttpRequest.DONE) {
                var l = {
                    Time: Date.now()
                }

                try {
                    console.log('Fetch completed', j.status, j.statusText)
                    if (j.status == 200) {
                        var data = JSON.parse(j.response)
                        l.lat = data.results[0].geometry.location.lat
                        l.lon = data.results[0].geometry.location.lng
                    }
                } catch(e) {
                    var data
                    try {
                        data = j.response
                        data = JSON.parse(data)
                    } catch(_) {}
                    console.error(e, data)
                }

                this.$set(this.locationCache, loc, l)

                this.locationCacheRefresh()
            }
        },
        locationCacheRefreshInternal() {
            var tooYoung = new Date()
            tooYoung.setMonth(tooYoung.getMonth() - 1)
            tooYoung = tooYoung.getTime()

            var results = this.results
            var shift = Math.floor(Math.random() * results.length)
            for(var i = 0; i < results.length; ++i) {
                var loc = this.results[(shift + i) % results.length].Ort
                if (loc === undefined || loc === null || loc === '' || (
                    this.locationCache[loc] !== undefined &&
                    tooYoung < this.locationCache[loc].Time
                ))
                    continue
            
                var url = 'https://maps.googleapis.com/maps/api/geocode/json?key=' + this.googleApiKey + '&address=' + loc
                console.log('Fetch starting', url)
                var j = new XMLHttpRequest()
                j.onreadystatechange = () => {
                    this.locationCacheRefreshInternalCb(j, loc)
                }
                j.open('GET', url)
                j.send()

                return
            }

            setTimeout(this.locationCacheRefreshInternal, 10000 + Math.random() * 5000)
        },
        locationCacheRefresh() {
            setTimeout(this.locationCacheRefreshInternal, 10000 + Math.random() * 5000)
        },
        
        storeChanged() {
            if (this.ignoreUpdate) {
                console.log('Store Update ignored')
                return
            }

            if (this.storeSetRunning) {
                console.log('Store running, Update delayed')
                this.storeSetPending = true
                return
            }

            console.log('Store writing')
            this.storeIntern()
        },
        storeIntern() {
            this.storeSetRunning = true
            this.storeSetPending = false

            var data = {
                columnsOrder: this.columnsOrder,
                sites: this.sites.map(s => Object.assign({}, s)),
                changes: this.changes,
                locationCache: this.locationCache,
                googleApiKey: this.googleApiKey,
            }
            data.sites.forEach(s => s.results = [])
            ipc.send('storeSet', data)
        },
        storeSetDone() {
            console.log('Store wrote')
            this.storeSetRunning = false

            if (this.storeSetPending) {
                console.log('Store resuming delayed Update')
                this.storeIntern()
            }
        },
        storeSet(_, data) {
            console.log('Store read')

            try {
                this.ignoreUpdate = true
                Object.assign(this.$data, data)
            } finally {
                Vue.nextTick(() => {
                    this.ignoreUpdate = false
                })
            }
        },

        siteAdd(site) {
            this.sites.push(Object.assign({}, site))
        },
        siteDel(i) {
            this.sites.splice(i, 1)
        },
    },
})