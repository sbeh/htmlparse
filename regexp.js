process.on('uncaughtException', error => {
    console.log(error)
    process.send({ error: error.message })
})

process.on('message', data => {
    var {regexp, content} = data, matches = [], match
    regexp = new RegExp(regexp, 'gu')
    while(match = regexp.exec(content)) {
        match.shift()
        matches.push(match)
    }
    process.send({ result: matches })
})