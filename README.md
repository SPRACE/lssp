# lssp

LDAP Self Service Password is a small nodejs project which allow users the
ability to change your password in ldap.

## Install dependencies

```bash
$ npm install .
```

## Configure

Copy the original config file and make the propper changes:

```bash
$ cp config/default.json.dist config/default.json
```

## Install utility script on ldap machine

This script is a small piece of code responsible for changing the password on
LDAP.

For security reasons the nodejs app is not allowed to change the LDAP password
directly. We need a secure connection (ssh) with the LDAP machine to run this
script.

Again, for security reasons, the LDAP admin password is stored in LDAP machine,
please adjust the settings variable `LDAP_PASS_FILE`.

For instance to copy to `your.ldap.your.domain`, run:

```bash
$ scp scripts/change-ldap-password root@your.ldap.your.domain:/usr/local/sbin/
```

## Configure the settings for the utility script (ldap machine)

You need to create the file `/root/.lssprc` with few variables, copy from
template and make the propper changes:

```bash
$ scp config/.lssprc.dist root@your.ldap.your.domain:.lssprc
```

## Hacking

Nodemon is a utility that will monitor for any changes in your source and
automatically restart your server. Perfect for development. Install it using
npm.

```bash
$ sudo npm install -g nodemon
```

Just use nodemon instead of node to run your code:

```bash
$ nodemon app.js
```
