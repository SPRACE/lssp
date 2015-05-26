// Requires
var express = require('express');
var loki = require('lokijs');
var ldapjs = require('ldapjs');
var uuid = require('uuid');
var sendmail = require('sendmail')();
var bodyParser = require('body-parser');
var config = require('config');

var app = express();
app.use(express.static(__dirname+'/static'));

var db = new loki('lssp.json')
var tokens = db.addCollection('tokens')

var ldap = ldapjs.createClient({
  url: config.get('ldap.url')
});

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

function search_user(userid, callback) {
  ret = { 'dn': '', 'email': '' };

  var opts = {
    filter: '(|(uid~='+userid+')(email='+userid+'))',
    attributes: ['dn', 'mail'],
    scope: 'sub'
  };

  ldap.search(config.get('ldap.base'), opts, function(err, res) {
    var count = 0;

    //assert.ifError(err);
    res.on('searchEntry', function(entry) {
      count = count + 1;
      ret.dn = entry.object.dn;
      ret.email = entry.object.mail;
    });
  
    res.on('error', function(err) {
      console.error('error: ' + err.message);
    });

    res.on('end', function(result) {
      // check for more than one result
      if (count > 1) {
        ret = { dn: '', email: '' };
      }
      console.log(ret);
      callback(ret);
    });
  });
}

function update_password(dn, password, callback) {
  var admin_dn = '';
  var admin_password = '';
  ldap.bind(admin_dn, admin_password, function (err) {
    //assert.ifError(err);
    console.log(err);
  });

  // TODO: Salted SHA
  password_ssha = password+'salt';

  var change = new ldap.Change({
    operation: 'replace',
    modification: {
      userPassword: [ password_ssha ]
    }
  });

  client.modify(dn, change, function(err) {
    //assert.ifError(err);
    callback();
  });
}

app.post('/api/reset', function (req, res) {
  var userid = req.body.userid;

  // TODO: check if IP not abusing
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  //tokens.find( {'ip':ip } )

  // search LDAP for username / email
  var user = search_user(userid, function(user) {
    if (user.dn) {
      // generate token
      user.token = uuid.v4();

      // save
      tokens.insert({ token: user.token, dn: user.dn,
                      email:user.email, timestamp:new Date(), ip:ip });

      // send email
      /*
      sendmail({
        from: 'no-reply@ncc.unesp.br',
        to: 'bla@ncc.unesp.br',
        subject: '[NCC/UNESP] Change password request',
        content: 'bla, bla, bla\n' + user.token + '\nbla\n',
        }, function(err, reply) {
          console.log(err && err.stack);
          console.dir(reply);
      });
      */
      ret = { success: true, message: 'email sent to :' + user.email };
      res.type('json');
      res.send(JSON.stringify(ret));

      console.log(user.token)

    } else {
      // no user (or more than one)
      res.status(404);
      res.type('json');
      ret = { success: false, message: 'invalid user' };
      res.send(JSON.stringify(ret));
    }

  });
});

app.post('/api/confirm', function (req, res) {
  var token = req.body.token;
  var password = req.body.password;

  // check token
  var user = tokens.findOne({token: token});

  var exp_time = 3 * 60 * 60 * 1000; // 3 hours

  // check if token exist and is valid
  if ((user) && ((Date() - user.timestamp) < exp_time)) {
    // set new passwod
    change_password(user.dn, password, function(){

      // send mail
      /*
      sendmail({
        from: 'no-reply@ncc.unesp.br',
        to: 'bla@ncc.unesp.br',
        subject: '[NCC/UNESP] Change password request',
        content: 'bla, bla, bla\n' + user.token + '\nbla\n',
        }, function(err, reply) {
          console.log(err && err.stack);
          console.dir(reply);
      });
      */

      ret = { success: true, message: 'password changed' };
      res.type('json');
      res.send(JSON.stringify(ret));
    })
  } else {
    // no user (or more than one)
    res.status(404);
    res.type('json');
    ret = { success: false, message: 'invalid token' };
    res.send(JSON.stringify(ret));
  }


});

app.listen(3000)
