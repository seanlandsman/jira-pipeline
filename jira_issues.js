const request = require('request');
const Q = require('q');
const fs = require('fs');

// a hundred issues per batch
const maxResults = 100;

const jiraReports = [
    {
        destinationFilename: "next_version_done.json",
        url: "https://ag-grid.atlassian.net/rest/api/2/search?jql=filter=10202"
    },
    {
        destinationFilename: "next_version_notdone.json",
        url: "https://ag-grid.atlassian.net/rest/api/2/search?jql=filter=10204"
    },
    {
        destinationFilename: "backlog.json",
        url: "https://ag-grid.atlassian.net/rest/api/2/search?jql=filter=10201"
    },
    {
        destinationFilename: "changelog.json",
        url: "https://ag-grid.atlassian.net/rest/api/2/search?jql=filter=10203+order+by+fixversion+desc"
    },
];

function doRequest(base64Credentials, url, startAt) {
    const headers = {
        'Authorization': `Basic ${base64Credentials}`,
        'Content-Type': 'application/json'
    };

    const options = {
        url: `${url}\&startAt=${startAt}\&maxResults=${maxResults}`,
        headers: headers
    };

    let deferred = Q.defer();
    request(options, (error, response, body) => {
        if (!error && response.statusCode === 200) {
            deferred.resolve(body)
        } else {
            deferred.reject(new Error(error));
        }
    });

    return deferred.promise;
}

fs.readFile(__dirname + '/credentials.txt', 'utf8', (err, base64Credentials) => {
    if (err) {
        return console.log(err);
    }

    jiraReports.forEach((jiraReport) => {
        doRequest(base64Credentials, jiraReport.url, 0)
            .then((data) => {
                let jiraData = JSON.parse(data);

                let totalResults = jiraData.total;
                let pages = Math.ceil(totalResults / 100);

                let allCalls = [];
                for(let page = 1; page <= pages; page++) {
                    allCalls.push(doRequest(base64Credentials, jiraReport.url, (maxResults * page)));
                }

                Q.allSettled(allCalls).then((results) => {
                    results.forEach((result) => {
                        if (result.state === "fulfilled") {
                            const pageData = JSON.parse(result.value);
                            jiraData.issues = jiraData.issues.concat(pageData.issues)
                        }
                    });

                    fs.writeFile(jiraReport.destinationFilename, JSON.stringify(jiraData), (err) => {
                        if (err) throw err;

                        console.log(`${jiraReport.destinationFilename} saved`);
                    });
                })
            });
    });
});




