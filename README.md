# cc

![logo](logo-caption.png)

## Setup

Follow these steps to setup a local development environment.

### Prerequisites
This software should be installed on your machine to develop on this project.

#### Docker Desktop
Download and install [Docker Desktop](https://docs.docker.com/get-docker/). 
It's the only required software.

#### NVM (optional)
This repo sets up a Node JS virtual machine using Docker Compose. However, it
may be convenient to install Node JS on your local machine anyway. I recommend
using [NVM](https://github.com/nvm-sh/nvm) to manage Node JS versions. This
repo contains an `.nvmrc` file and if you follow the NVM setup instructions, 
especially the section on 
[shell integration](https://github.com/nvm-sh/nvm#deeper-shell-integration) 
you can make NVM switch to the right Node version based on the `.nvmrc` file
automatically whenever you change directories to this project.

#### Visual Studio Code (optional)
This is optional, but I highly recommend 
[Visual Studio Code](https://code.visualstudio.com/). It works very well
and it's what I used to develop on this project myself.


### Start the dev environment
Make sure you have the [prerequisites](#prerequisites) installed. 

Copy `example.env` to `.env` and make sure you are ok with it's contents.

Run this command from the project folder to start a development environment:

```sh
docker compose up -d
```

This will download and install [NGINX](https://www.nginx.com/) and 
[MariaDB](https://mariadb.org/). You can also 
[select another database](#select-another-database).

After startup, you can [setup SSL](#setup-ssl) and then connect your
browser to [https://cc.localhost](https://cc.localhost).

### Setup SSL

On first run, the `proxy/setup.js` script will generate a bunch of
SSL certificate files in `proxy/certs`:

* ca.crt
* ca.key
* ca.pem
* ca.srl
* cc.localhost.crt
* cc.localhost.csr
* cc.localhost.ext
* cc.localhost.key

The setup script will generate the `*.localhost.*` files based on the `NAME`
environment variable configured in `.env`. You can also directly control the
domain name for the project by editing `proxy/domains.template`. Check the 
logs of the `web` docker container for details.

The `ca.*` files are actually a self-signed certificate authority that is in
turn used to sign the domain certificates. Double-click `ca.crt` to install
the certificate authority as a trusted authority on your machine, to make
your browser trust your self-signed certificates. 

Once you have added the certificate authority and restarted your browser, you
should be able to visit [https://cc.localhost](https://cc.localhost) with a
trusted SSL certificate.

### Stop the dev environment
To stop the dev environment, run

```sh
docker compose down
```

## Select another database

This repo actually comes with `compose.yml` files for 3 different databases:

* [MariaDB](https://mariadb.org/) (in `db/mariadb`)
* [MySQL](https://mysql.com/) (in `db/mysql`)
* [PostgreSQL](https://www.postgresql.org/) (in `db/postgres`)

To select which database to use, set the environment variable `DB_TYPE` in 
`.env` to one of `mariadb`, `mysql` or `postgres`. More details in  `.env`.
