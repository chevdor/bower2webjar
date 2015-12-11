#!/usr/bin/env node

var request = require('request');
var fs = require('fs');
var path = require("path");
var stdio = require('stdio');
var pjson = require("./package.json");

var ops = stdio.getopt({
    'repo': {
        key: 'r',
        description: 'The repository. For instance PolymerElements/iron-elements',
        args: 1
    },
    'template': {
        key: 't',
        description: 'Where shall we take the templates from?',
        args: 1,
        default: null
    },
    'list-deps': {
        key: 'l',
        description: 'List dependencies only',
        args: 0,
    },
    'groupId': {
        key: 'g',
        description: 'GroupId for the POM',
        args: 1,
        default: 'org.chevdor.webjars'
    },
    'version': {
        key: 'v',
        description: 'Displays current version',
        args: 1
    }
});

if (ops.version) {
    console.log(pjson.name + ' version ' + pjson.version);
    process.exit(0);
} else {
    if (!ops.repo) {
        console.log('Please provide at the very least the repo. Use --help for details.');
        process.exit(1);
    } else {
        var url = 'https://raw.githubusercontent.com/' + ops.repo + '/master/bower.json';

        if (ops['list-deps'])
            listDependencies(url);
        else
            run(url);
    }
}

var rmdir = function(dir) {
    var list = fs.readdirSync(dir);
    for (var i = 0; i < list.length; i++) {
        var filename = path.join(dir, list[i]);
        var stat = fs.statSync(filename);

        if (filename == "." || filename == "..") { // skip these files
        } else if (stat.isDirectory()) { // rmdir recursively
            rmdir(filename);
        } else { // rm filename
            fs.unlinkSync(filename);
        }
    }
    fs.rmdirSync(dir);
};

function getVersion(str) {
    if (str === "*")
        return '[0.0.0,)';

    var v = str;

    if (str.indexOf('#') > -1)
        v = str.split('#')[1];

    v = v.replace('^', '');

    // following recomm: https://maven.apache.org/enforcer/enforcer-rules/versionRanges.html
    return '[' + v + ',)';
}

function generateDeps(bw) {
    if (!bw.dependencies)
        return "";

    var res = '<dependencies>\n';


    var deps = bw.dependencies;

    for (var property in deps) {
        if (deps.hasOwnProperty(property)) {
            //res += property + ' ' + deps[property] +  '\n';
            res += '\t\t<dependency>\n';
            res += '\t\t\t<groupId>org.chevdor.webjars</groupId>\n';
            res += '\t\t\t<artifactId>' + property + '</artifactId>\n';
            res += '\t\t\t<version>' + getVersion(deps[property]) + '</version>\n';
            res += '\t\t</dependency>\n';
        }
    }

    res += '\t</dependencies>';
    return res;
}

// read file from the template folder
// proceed to the replacements based on data
// return the new file content
function substitude(filename, data) {
    if (!filename) return;
    if (!data) return fs.readFileSync(filename, 'utf8');

    var tokenStart = '{{';
    var tokenEnd = '}}';

    var file = fs.readFileSync(filename, 'utf8');
    for (var dat in data) {
        if (data.hasOwnProperty(dat)) {
            file = file.replace(tokenStart + dat + tokenEnd, data[dat]);
        }
    }

    return file;
}

function getData(bw) {
    var d = {};
    var deps = generateDeps(bw);

    d.dependencies = deps;
    d.groupId = ops.groupId;
    d.artifactId = bw.name;
    d.version = bw.version;
    d.name = bw.name;
    d.description = bw.description;
    d.url = bw.homepage;

    if (d.repository)
        d.repository = bw.repository.url;

    d.developerId = 'polymerAuthors';
    d.developerName = 'The Polymer Authors';
    d.license = bw.license;
    d.repo = ops.repo;

    return d;
}

function listDependencies(url, template, out) {
    console.log('Fetching ' + url);

    request.get(url, function(error, response, body) {
        if (error)
            console.log(error);

        if (response.statusCode != 200)
            console.log('Hmmm we get a status ' + response.statusCode);

        if (!error && response.statusCode == 200) {
            var bower = JSON.parse(body);
            console.log('dependencies for ' + bower.name + ':');

            if (bower.dependencies)
                console.log(bower.dependencies);
            else
                console.log('no dependencies');
        }
    });
}

function run(url, template, out) {
    console.log('Fetching ' + url);

    request.get(url, function(error, response, body) {
        if (error)
            console.log(error);

        if (response.statusCode != 200)
            console.log('Hmmm we get a status ' + response.statusCode);

        if (!error && response.statusCode == 200) {

            var bower = JSON.parse(body);
            console.log('Processing ' + bower.name);

            var data = getData(bower);
            var target = data.groupId + '.' + data.artifactId;

            var template = ops.template || __dirname + '/webjar-maven-polymer/';

            // those are taken from the template and generated with the same names
            var files = {
                gitignore: {
                    name: '.gitignore'
                },
                pom: {
                    name: 'pom.xml'
                },
                readme: {
                    name: 'README.md'
                }
            };

            for (var f in files) {
                if (files.hasOwnProperty(f)) {
                    files[f].data = substitude(template + files[f].name, data);
                }
            }

            if (fs.existsSync(target))
                rmdir(target);

            fs.mkdirSync(target);

            console.log('Generating files:');
            for (var outf in files) {
                if (files.hasOwnProperty(f)) {
                    //files[f].data = substitude(template + files[outf].name, data);
                    fs.writeFileSync(target + '/' + files[outf].name, files[outf].data, 'utf8');
                    console.log('\t' + files[outf].name);
                }
            }
            console.log('done');
        }
    });
}
