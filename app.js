// Requires
var express = require('express');
var loki = require('lokijs');
var ldapjs = require('ldapjs');
var uuid = require('uuid');
var sendmail = require('sendmail')();
var bodyParser = require('body-parser');
var config = require('config');
var ssh2 = require('ssh2');
var fs = require('fs');

var app = express();
app.use(express.static(__dirname+'/static'));

var db = new loki('lssp.json')
var tokens = db.addCollection('tokens')

var ldap = ldapjs.createClient({
  url: config.get('ldap.url')
});

// for parsing application/json
app.use(bodyParser.json());
// for parsing application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

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

  var conn = new ssh2.Client();
  var args = dn + " " + password;
  var exec = config.get('ssh.command') + " " + args;
  console.log(exec);
  conn.on('ready', function() {
    console.log('SSH Client ready');
    conn.exec(exec, function(err, stream) {
      if (err) throw err;
      stream.on('close', function(code, signal) {
        console.log('SSH closed. Code: ' + code + ', Signal: ' + signal);
        conn.end();
        callback(code);
      }).on('data', function(data) {
        console.log('STDOUT: ' + data);
      }).stderr.on('data', function(data) {
        console.log('STDERR: ' + data);
      });
    });
  }).connect({
    host: config.get('ssh.host'),
    port: config.get('ssh.port'),
    username: config.get('ssh.user'),
    privateKey: fs.readFileSync(config.get('ssh.key'))
  });

}

function send_email(body, subject, from, to, callback) {
  sendmail({
    from: from,
    to: to,
    subject: subject,
    content: body,
    }, function(err, reply) {
      console.log(err && err.stack);
      console.dir(reply);
  });

  callback();
}

app.post('/api/reset', function (req, res) {
  var userid = req.body.userid;

  console.log("Reset");
  console.log(userid);

  // TODO: check if IP not abusing
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  // search LDAP for username / email
  var user = search_user(userid, function(user) {
    if (user.dn) {
      // generate token
      user.token = uuid.v4();

      // save
      tokens.insert({ token: user.token, dn: user.dn,
                      email:user.email, timestamp: new Date(), ip:ip });

      // Send email to admins
      var body = "Password reset requested to user " + userid
      var subject = "[lssp] Password reset was requested"

      send_email(body, subject, config.get('email.from'), config.get('email.admin'));

      // Send email to user
      var body  = "An user has requested a password change for your account.\n"
          body += "If you dont recnogize this request, please ignore this email.\n"
          body += "Otherwise follow the link to confirm and choose a new password:\n\n"
          body += config.get('url.base') + "/password/confirm.html?token=" + user.token
          body += "\n\nThis link is valid only for 3 hours.\n"
          body += "--\n"
          body += "NCC Team\n"
          body += "support@ncc.unesp.br"

      var subject = "Password reset request for your account";

      send_email(body, subject, config.get('email.from'), user.email, function() {
        ret = { success: true,
                message: "Confirmation link was sent to your email.",
                email: user.email.replace(/^.+@/i, 'xxxx@')};

        res.type('json');
        res.send(JSON.stringify(ret));

        console.log(user.token)
      });
    } else {
      // no user (or more than one)
      res.status(404);
      res.type('json');
      ret = { success: false,
              message: 'Invalid user or email.' };
      res.send(JSON.stringify(ret));
    }

  });
});

app.post('/api/confirm', function (req, res) {
  var token = req.body.token;
  var password = req.body.password;

  // check token
  var user = tokens.findOne({token: token});
  console.log(user);

  var exp_time = 3 * 60 * 60 * 1000; // 3 hours

  // check if token exist and is valid
  if ((user) && ((new Date() - user.timestamp) < exp_time)) {
    // set new passwod
    update_password(user.dn, password, function(code){

      if (code == 0) {
        ret = { success: true,
                message: 'Your password was changed.' };

        // send email
        var body  = "Your password has been updated!\n"
        var body  = "Please use the new password for further logins.\n"
            body += "--\n"
            body += "NCC Team\n"
            body += "support@ncc.unesp.br"
        var subject = "Your password has been updated.";
        send_email(body, subject, config.get('email.from'), user.email, function() {
          res.type('json');
          res.send(JSON.stringify(ret));
        });
      } else {
        res.status(404);
        res.type('json');
        ret = { success: false,
                message: 'Failed to change your password.' };
        res.send(JSON.stringify(ret));
      }
    })
  } else {
    // no user (or more than one)
    res.status(404);
    res.type('json');
    ret = { success: false,
            message: 'Token invalid or expired.' };
    res.send(JSON.stringify(ret));
  }
});

app.listen(3000)
