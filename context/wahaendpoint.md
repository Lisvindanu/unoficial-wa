🖥️ Sessions
Control WhatsApp sessions (accounts)



GET
/api/sessions
List all sessions


Parameters
Try it out
Name	Description
all
boolean
(query)
Return all sessions, including those that are in the STOPPED state.


false
Responses
Code	Description	Links
200	
Media type

application/json
Controls Accept header.
Example Value
Schema
[
  {
    "name": "default",
    "me": {
      "id": "11111111111@c.us",
      "lid": "123123@lid",
      "jid": "123123:123@s.whatsapp.net",
      "pushName": "string"
    },
    "assignedWorker": "string",
    "status": "STOPPED",
    "config": {
      "metadata": {
        "user.id": "123",
        "user.email": "email@example.com"
      },
      "proxy": null,
      "debug": false,
      "ignore": {
        "status": null,
        "groups": null,
        "channels": null
      },
      "noweb": {
        "store": {
          "enabled": true,
          "fullSync": false
        }
      },
      "webjs": {
        "tagsEventsOn": false
      },
      "webhooks": [
        {
          "url": "https://webhook.site/11111111-1111-1111-1111-11111111",
          "events": [
            "message",
            "session.status"
          ],
          "hmac": null,
          "retries": null,
          "customHeaders": null
        }
      ]
    }
  }
]
No links

POST
/api/sessions
Create a session


Create session a new session (and start it at the same time if required).

Parameters
Try it out
No parameters

Request body

application/json
Example Value
Schema
{
  "name": "default",
  "start": true,
  "config": {
    "metadata": {
      "user.id": "123",
      "user.email": "email@example.com"
    },
    "proxy": null,
    "debug": false,
    "ignore": {
      "status": null,
      "groups": null,
      "channels": null
    },
    "noweb": {
      "store": {
        "enabled": true,
        "fullSync": false
      }
    },
    "webjs": {
      "tagsEventsOn": false
    },
    "webhooks": [
      {
        "url": "https://webhook.site/11111111-1111-1111-1111-11111111",
        "events": [
          "message",
          "session.status"
        ],
        "hmac": null,
        "retries": null,
        "customHeaders": null
      }
    ]
  }
}
Responses
Code	Description	Links
201	
Media type

application/json
Controls Accept header.
Example Value
Schema
{
  "name": "default",
  "status": "STOPPED",
  "config": {
    "metadata": {
      "user.id": "123",
      "user.email": "email@example.com"
    },
    "proxy": null,
    "debug": false,
    "ignore": {
      "status": null,
      "groups": null,
      "channels": null
    },
    "noweb": {
      "store": {
        "enabled": true,
        "fullSync": false
      }
    },
    "webjs": {
      "tagsEventsOn": false
    },
    "webhooks": [
      {
        "url": "https://webhook.site/11111111-1111-1111-1111-11111111",
        "events": [
          "message",
          "session.status"
        ],
        "hmac": null,
        "retries": null,
        "customHeaders": null
      }
    ]
  }
}
No links

GET
/api/sessions/{session}
Get session information


Parameters
Try it out
Name	Description
session *
(path)
Session name

Default value : default

default
Responses
Code	Description	Links
200	
Media type

application/json
Controls Accept header.
Example Value
Schema
{
  "name": "default",
  "me": {
    "id": "11111111111@c.us",
    "lid": "123123@lid",
    "jid": "123123:123@s.whatsapp.net",
    "pushName": "string"
  },
  "assignedWorker": "string",
  "status": "STOPPED",
  "config": {
    "metadata": {
      "user.id": "123",
      "user.email": "email@example.com"
    },
    "proxy": null,
    "debug": false,
    "ignore": {
      "status": null,
      "groups": null,
      "channels": null
    },
    "noweb": {
      "store": {
        "enabled": true,
        "fullSync": false
      }
    },
    "webjs": {
      "tagsEventsOn": false
    },
    "webhooks": [
      {
        "url": "https://webhook.site/11111111-1111-1111-1111-11111111",
        "events": [
          "message",
          "session.status"
        ],
        "hmac": null,
        "retries": null,
        "customHeaders": null
      }
    ]
  }
}
No links

PUT
/api/sessions/{session}
Update a session


Parameters
Try it out
Name	Description
session *
(path)
Session name

Default value : default

default
Request body

application/json
Example Value
Schema
{
  "config": {
    "metadata": {
      "user.id": "123",
      "user.email": "email@example.com"
    },
    "proxy": null,
    "debug": false,
    "ignore": {
      "status": null,
      "groups": null,
      "channels": null
    },
    "noweb": {
      "store": {
        "enabled": true,
        "fullSync": false
      }
    },
    "webjs": {
      "tagsEventsOn": false
    },
    "webhooks": [
      {
        "url": "https://webhook.site/11111111-1111-1111-1111-11111111",
        "events": [
          "message",
          "session.status"
        ],
        "hmac": null,
        "retries": null,
        "customHeaders": null
      }
    ]
  }
}
Responses
Code	Description	Links
200	
Media type

application/json
Controls Accept header.
Example Value
Schema
{
  "name": "default",
  "status": "STOPPED",
  "config": {
    "metadata": {
      "user.id": "123",
      "user.email": "email@example.com"
    },
    "proxy": null,
    "debug": false,
    "ignore": {
      "status": null,
      "groups": null,
      "channels": null
    },
    "noweb": {
      "store": {
        "enabled": true,
        "fullSync": false
      }
    },
    "webjs": {
      "tagsEventsOn": false
    },
    "webhooks": [
      {
        "url": "https://webhook.site/11111111-1111-1111-1111-11111111",
        "events": [
          "message",
          "session.status"
        ],
        "hmac": null,
        "retries": null,
        "customHeaders": null
      }
    ]
  }
}
No links

DELETE
/api/sessions/{session}
Delete the session


Delete the session with the given name. Stop and logout as well. Idempotent operation.

Parameters
Try it out
Name	Description
session *
(path)
Session name

Default value : default

default
Responses
Code	Description	Links
200	
No links

GET
/api/sessions/{session}/me
Get information about the authenticated account


Parameters
Try it out
Name	Description
session *
(path)
Session name

Default value : default

default
Responses
Code	Description	Links
200	
Media type

application/json
Controls Accept header.
Example Value
Schema
{
  "id": "11111111111@c.us",
  "lid": "123123@lid",
  "jid": "123123:123@s.whatsapp.net",
  "pushName": "string"
}
No links

POST
/api/sessions/{session}/start
Start the session


Start the session with the given name. The session must exist. Idempotent operation.

Parameters
Try it out
Name	Description
session *
(path)
Session name

Default value : default

default
Responses
Code	Description	Links
201	
Media type

application/json
Controls Accept header.
Example Value
Schema
{
  "name": "default",
  "status": "STOPPED",
  "config": {
    "metadata": {
      "user.id": "123",
      "user.email": "email@example.com"
    },
    "proxy": null,
    "debug": false,
    "ignore": {
      "status": null,
      "groups": null,
      "channels": null
    },
    "noweb": {
      "store": {
        "enabled": true,
        "fullSync": false
      }
    },
    "webjs": {
      "tagsEventsOn": false
    },
    "webhooks": [
      {
        "url": "https://webhook.site/11111111-1111-1111-1111-11111111",
        "events": [
          "message",
          "session.status"
        ],
        "hmac": null,
        "retries": null,
        "customHeaders": null
      }
    ]
  }
}
No links

POST
/api/sessions/{session}/stop
Stop the session


Stop the session with the given name. Idempotent operation.

Parameters
Try it out
Name	Description
session *
(path)
Session name

Default value : default

default
Responses
Code	Description	Links
201	
Media type

application/json
Controls Accept header.
Example Value
Schema
{
  "name": "default",
  "status": "STOPPED",
  "config": {
    "metadata": {
      "user.id": "123",
      "user.email": "email@example.com"
    },
    "proxy": null,
    "debug": false,
    "ignore": {
      "status": null,
      "groups": null,
      "channels": null
    },
    "noweb": {
      "store": {
        "enabled": true,
        "fullSync": false
      }
    },
    "webjs": {
      "tagsEventsOn": false
    },
    "webhooks": [
      {
        "url": "https://webhook.site/11111111-1111-1111-1111-11111111",
        "events": [
          "message",
          "session.status"
        ],
        "hmac": null,
        "retries": null,
        "customHeaders": null
      }
    ]
  }
}
No links

POST
/api/sessions/{session}/logout
Logout from the session


Logout the session, restart a session if it was not STOPPED

Parameters
Try it out
Name	Description
session *
(path)
Session name

Default value : default

default
Responses
Code	Description	Links
201	
Media type

application/json
Controls Accept header.
Example Value
Schema
{
  "name": "default",
  "status": "STOPPED",
  "config": {
    "metadata": {
      "user.id": "123",
      "user.email": "email@example.com"
    },
    "proxy": null,
    "debug": false,
    "ignore": {
      "status": null,
      "groups": null,
      "channels": null
    },
    "noweb": {
      "store": {
        "enabled": true,
        "fullSync": false
      }
    },
    "webjs": {
      "tagsEventsOn": false
    },
    "webhooks": [
      {
        "url": "https://webhook.site/11111111-1111-1111-1111-11111111",
        "events": [
          "message",
          "session.status"
        ],
        "hmac": null,
        "retries": null,
        "customHeaders": null
      }
    ]
  }
}
No links

POST
/api/sessions/{session}/restart
Restart the session


Restart the session with the given name.

Parameters
Try it out
Name	Description
session *
(path)
Session name

Default value : default

default
Responses
Code	Description	Links
201	
Media type

application/json
Controls Accept header.
Example Value
Schema
{
  "name": "default",
  "status": "STOPPED",
  "config": {
    "metadata": {
      "user.id": "123",
      "user.email": "email@example.com"
    },
    "proxy": null,
    "debug": false,
    "ignore": {
      "status": null,
      "groups": null,
      "channels": null
    },
    "noweb": {
      "store": {
        "enabled": true,
        "fullSync": false
      }
    },
    "webjs": {
      "tagsEventsOn": false
    },
    "webhooks": [
      {
        "url": "https://webhook.site/11111111-1111-1111-1111-11111111",
        "events": [
          "message",
          "session.status"
        ],
        "hmac": null,
        "retries": null,
        "customHeaders": null
      }
    ]
  }
}
No links

POST
/api/sessions/start
Upsert and Start session



POST
/api/sessions/stop
Stop (and Logout if asked) session



POST
/api/sessions/logout
Logout and Delete session.


🧩 Apps
Applications (built-in integrations)



GET
/api/apps
List all apps for a session


Parameters
Try it out
Name	Description
session *
string
(query)
Session name to list apps for

default
Responses
Code	Description	Links
200	
No links

POST
/api/apps
Create a new app


Parameters
Try it out
No parameters

Request body

application/json
Example Value
Schema
{
  "enabled": true,
  "id": "string",
  "session": "string",
  "app": "chatwoot",
  "config": {}
}
Responses
Code	Description	Links
201	
No links

GET
/api/apps/{id}
Get app by ID


Parameters
Try it out
Name	Description
id *
string
(path)
id
Responses
Code	Description	Links
200	
No links

PUT
/api/apps/{id}
Update an existing app


Parameters
Try it out
Name	Description
id *
string
(path)
id
Request body

application/json
Example Value
Schema
{
  "enabled": true,
  "id": "string",
  "session": "string",
  "app": "chatwoot",
  "config": {}
}
Responses
Code	Description	Links
200	
No links

DELETE
/api/apps/{id}
Delete an app


Parameters
Try it out
Name	Description
id *
string
(path)
id
Responses
Code	Description	Links
200	
No links

POST
/webhooks/chatwoot/{session}/{id}
Chatwoot Webhook

Chatwoot Webhook

Parameters
Try it out
Name	Description
session *
string
(path)
session
id *
string
(path)
id
Responses
Code	Description	Links
201	
No links

GET
/api/apps/chatwoot/locales
Get available languages for Chatwoot app


Get available languages for Chatwoot app

Parameters
Try it out
No parameters

Responses
Code	Description	Links
200	
Media type

application/json
Controls Accept header.
Example Value
Schema
[
  {}
]
No links
🔑 Auth
Authentication



GET
/api/{session}/auth/qr
Get QR code for pairing WhatsApp API.


Parameters
Try it out
Name	Description
session *
(path)
Session name

Default value : default

default
format *
string
(query)
Available values : image, raw

Default value : image


image
Responses
Code	Description	Links
200	
Media type

image/png
Controls Accept header.
Example Value
Schema
string
No links

POST
/api/{session}/auth/request-code
Request authentication code.


Parameters
Try it out
Name	Description
session *
(path)
Session name

Default value : default

default
Request body

application/json
Example Value
Schema
{
  "phoneNumber": "12132132130",
  "method": null
}
Responses
Code	Description	Links
201	
No links
🆔 Profile
Your profile information



GET
/api/{session}/profile
Get my profile


Parameters
Try it out
Name	Description
session *
(path)
Session name

Default value : default

default
Responses
Code	Description	Links
200	
Media type

application/json
Controls Accept header.
Example Value
Schema
{
  "id": "11111111111@c.us",
  "picture": "https://example.com/picture.jpg",
  "name": "string"
}
No links

PUT
/api/{session}/profile/name
Set my profile name


Parameters
Try it out
Name	Description
session *
(path)
Session name

Default value : default

default
Request body

application/json
Example Value
Schema
{
  "name": "My New Name"
}
Responses
Code	Description	Links
200	
Media type

application/json
Controls Accept header.
Example Value
Schema
{
  "success": true
}
No links

PUT
/api/{session}/profile/status
Set profile status (About)


Parameters
Try it out
Name	Description
session *
(path)
Session name

Default value : default

default
Request body

application/json
Example Value
Schema
{
  "status": "🎉 Hey there! I am using WhatsApp 🎉"
}
Responses
Code	Description	Links
200	
Media type

application/json
Controls Accept header.
Example Value
Schema
{
  "success": true
}
No links

PUT
/api/{session}/profile/picture
Set profile picture


Parameters
Try it out
Name	Description
session *
(path)
Session name

Default value : default

default
Request body

application/json
Example Value
Schema
{
  "file": {
    "mimetype": "image/jpeg",
    "filename": "filename.jpg",
    "url": "https://github.com/devlikeapro/waha/raw/core/examples/waha.jpg"
  }
}
Responses
Code	Description	Links
200	
Media type

application/json
Controls Accept header.
Example Value
Schema
{
  "success": true
}
No links

DELETE
/api/{session}/profile/picture
Delete profile picture


Parameters
Try it out
Name	Description
session *
(path)
Session name

Default value : default

default
Responses
Code	Description	Links
200	
Media type

application/json
Controls Accept header.
Example Value
Schema
{
  "success": true
}
No links

🗄️ Storage
Storage methods


Webhooks

POST
session.status
The event is triggered when the session status changes.

Parameters
No parameters

Request body

application/json
Example Value
Schema
{
  "id": "evt_01aaaaaaaaaaaaaaaaaaaaaaaa",
  "timestamp": 1634567890123,
  "session": "default",
  "metadata": {
    "user.id": "123",
    "user.email": "email@example.com"
  },
  "engine": "WEBJS",
  "event": "session.status",
  "payload": {
    "name": "default",
    "status": "STOPPED",
    "statuses": [
      {
        "status": "STOPPED",
        "timestamp": 0
      }
    ]
  },
  "me": {
    "id": "11111111111@c.us",
    "lid": "123123@lid",
    "jid": "123123:123@s.whatsapp.net",
    "pushName": "string"
  },
  "environment": {
    "version": "YYYY.MM.BUILD",
    "engine": "WEBJS",
    "tier": "PLUS",
    "browser": "/usr/path/to/bin/google-chrome"
  }
}
Responses
Code	Description	Links
200	
Return a 200 status to indicate that the data was received successfully

No links

POST
message
Incoming message.

Parameters
No parameters

Request body

application/json
Example Value
Schema
{
  "id": "evt_01aaaaaaaaaaaaaaaaaaaaaaaa",
  "timestamp": 1634567890123,
  "session": "default",
  "metadata": {
    "user.id": "123",
    "user.email": "email@example.com"
  },
  "engine": "WEBJS",
  "event": "message",
  "payload": {
    "id": "false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAA",
    "timestamp": 1666943582,
    "from": "11111111111@c.us",
    "fromMe": true,
    "source": "api",
    "to": "11111111111@c.us",
    "participant": "string",
    "body": "string",
    "hasMedia": true,
    "media": {
      "url": "http://localhost:3000/api/files/false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAA.oga",
      "mimetype": "audio/jpeg",
      "filename": "example.pdf",
      "s3": {
        "Bucket": "my-bucket",
        "Key": "default/false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAA.oga"
      },
      "error": null
    },
    "ack": -1,
    "ackName": "string",
    "author": "string",
    "location": {
      "description": "string",
      "latitude": "string",
      "longitude": "string"
    },
    "vCards": [
      "string"
    ],
    "_data": {},
    "replyTo": {
      "id": "AAAAAAAAAAAAAAAAAAAA",
      "participant": "11111111111@c.us",
      "body": "Hello!",
      "_data": {}
    }
  },
  "me": {
    "id": "11111111111@c.us",
    "lid": "123123@lid",
    "jid": "123123:123@s.whatsapp.net",
    "pushName": "string"
  },
  "environment": {
    "version": "YYYY.MM.BUILD",
    "engine": "WEBJS",
    "tier": "PLUS",
    "browser": "/usr/path/to/bin/google-chrome"
  }
}
Responses
Code	Description	Links
200	
Return a 200 status to indicate that the data was received successfully

No links

POST
message.reaction
The event is triggered when a user reacts or removes a reaction.

Parameters
No parameters

Request body

application/json
Example Value
Schema
{
  "id": "evt_01aaaaaaaaaaaaaaaaaaaaaaaa",
  "timestamp": 1634567890123,
  "session": "default",
  "metadata": {
    "user.id": "123",
    "user.email": "email@example.com"
  },
  "engine": "WEBJS",
  "event": "message.reaction",
  "payload": {
    "id": "false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAA",
    "timestamp": 1666943582,
    "from": "11111111111@c.us",
    "fromMe": true,
    "source": "api",
    "to": "11111111111@c.us",
    "participant": "string",
    "reaction": {
      "text": "string",
      "messageId": "false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAA"
    }
  },
  "me": {
    "id": "11111111111@c.us",
    "lid": "123123@lid",
    "jid": "123123:123@s.whatsapp.net",
    "pushName": "string"
  },
  "environment": {
    "version": "YYYY.MM.BUILD",
    "engine": "WEBJS",
    "tier": "PLUS",
    "browser": "/usr/path/to/bin/google-chrome"
  }
}
Responses
Code	Description	Links
200	
Return a 200 status to indicate that the data was received successfully

No links

POST
message.any
Fired on all message creations, including your own.

Parameters
No parameters

Request body

application/json
Example Value
Schema
{
  "id": "evt_01aaaaaaaaaaaaaaaaaaaaaaaa",
  "timestamp": 1634567890123,
  "session": "default",
  "metadata": {
    "user.id": "123",
    "user.email": "email@example.com"
  },
  "engine": "WEBJS",
  "event": "message.any",
  "payload": {
    "id": "false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAA",
    "timestamp": 1666943582,
    "from": "11111111111@c.us",
    "fromMe": true,
    "source": "api",
    "to": "11111111111@c.us",
    "participant": "string",
    "body": "string",
    "hasMedia": true,
    "media": {
      "url": "http://localhost:3000/api/files/false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAA.oga",
      "mimetype": "audio/jpeg",
      "filename": "example.pdf",
      "s3": {
        "Bucket": "my-bucket",
        "Key": "default/false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAA.oga"
      },
      "error": null
    },
    "ack": -1,
    "ackName": "string",
    "author": "string",
    "location": {
      "description": "string",
      "latitude": "string",
      "longitude": "string"
    },
    "vCards": [
      "string"
    ],
    "_data": {},
    "replyTo": {
      "id": "AAAAAAAAAAAAAAAAAAAA",
      "participant": "11111111111@c.us",
      "body": "Hello!",
      "_data": {}
    }
  },
  "me": {
    "id": "11111111111@c.us",
    "lid": "123123@lid",
    "jid": "123123:123@s.whatsapp.net",
    "pushName": "string"
  },
  "environment": {
    "version": "YYYY.MM.BUILD",
    "engine": "WEBJS",
    "tier": "PLUS",
    "browser": "/usr/path/to/bin/google-chrome"
  }
}
Responses
Code	Description	Links
200	
Return a 200 status to indicate that the data was received successfully

No links

POST
message.ack
Receive events when server or recipient gets the message, read or played it.

Parameters
No parameters

Request body

application/json
Example Value
Schema
{
  "id": "evt_01aaaaaaaaaaaaaaaaaaaaaaaa",
  "timestamp": 1634567890123,
  "session": "default",
  "metadata": {
    "user.id": "123",
    "user.email": "email@example.com"
  },
  "engine": "WEBJS",
  "event": "message.ack",
  "payload": {
    "id": "false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAA",
    "from": "11111111111@c.us",
    "to": "11111111111@c.us",
    "participant": "11111111111@c.us",
    "fromMe": true,
    "ack": -1,
    "ackName": "string",
    "_data": {}
  },
  "me": {
    "id": "11111111111@c.us",
    "lid": "123123@lid",
    "jid": "123123:123@s.whatsapp.net",
    "pushName": "string"
  },
  "environment": {
    "version": "YYYY.MM.BUILD",
    "engine": "WEBJS",
    "tier": "PLUS",
    "browser": "/usr/path/to/bin/google-chrome"
  }
}
Responses
Code	Description	Links
200	
Return a 200 status to indicate that the data was received successfully

No links

POST
message.revoked
The event is triggered when a user, whether it be you or any other participant, revokes a previously sent message.

Parameters
No parameters

Request body

application/json
Example Value
Schema
{
  "id": "evt_01aaaaaaaaaaaaaaaaaaaaaaaa",
  "timestamp": 1634567890123,
  "session": "default",
  "metadata": {
    "user.id": "123",
    "user.email": "email@example.com"
  },
  "engine": "WEBJS",
  "event": "message.revoked",
  "payload": {
    "revokedMessageId": "A06CA7BB5DD8C8F705628CDB7E3A33C9",
    "after": {
      "id": "false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAA",
      "timestamp": 1666943582,
      "from": "11111111111@c.us",
      "fromMe": true,
      "source": "api",
      "to": "11111111111@c.us",
      "participant": "string",
      "body": "string",
      "hasMedia": true,
      "media": {
        "url": "http://localhost:3000/api/files/false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAA.oga",
        "mimetype": "audio/jpeg",
        "filename": "example.pdf",
        "s3": {
          "Bucket": "my-bucket",
          "Key": "default/false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAA.oga"
        },
        "error": null
      },
      "ack": -1,
      "ackName": "string",
      "author": "string",
      "location": {
        "description": "string",
        "latitude": "string",
        "longitude": "string"
      },
      "vCards": [
        "string"
      ],
      "_data": {},
      "replyTo": {
        "id": "AAAAAAAAAAAAAAAAAAAA",
        "participant": "11111111111@c.us",
        "body": "Hello!",
        "_data": {}
      }
    },
    "before": {
      "id": "false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAA",
      "timestamp": 1666943582,
      "from": "11111111111@c.us",
      "fromMe": true,
      "source": "api",
      "to": "11111111111@c.us",
      "participant": "string",
      "body": "string",
      "hasMedia": true,
      "media": {
        "url": "http://localhost:3000/api/files/false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAA.oga",
        "mimetype": "audio/jpeg",
        "filename": "example.pdf",
        "s3": {
          "Bucket": "my-bucket",
          "Key": "default/false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAA.oga"
        },
        "error": null
      },
      "ack": -1,
      "ackName": "string",
      "author": "string",
      "location": {
        "description": "string",
        "latitude": "string",
        "longitude": "string"
      },
      "vCards": [
        "string"
      ],
      "_data": {},
      "replyTo": {
        "id": "AAAAAAAAAAAAAAAAAAAA",
        "participant": "11111111111@c.us",
        "body": "Hello!",
        "_data": {}
      }
    },
    "_data": {}
  },
  "me": {
    "id": "11111111111@c.us",
    "lid": "123123@lid",
    "jid": "123123:123@s.whatsapp.net",
    "pushName": "string"
  },
  "environment": {
    "version": "YYYY.MM.BUILD",
    "engine": "WEBJS",
    "tier": "PLUS",
    "browser": "/usr/path/to/bin/google-chrome"
  }
}
Responses
Code	Description	Links
200	
Return a 200 status to indicate that the data was received successfully

No links

POST
message.edited
The event is triggered when a user edits a previously sent message.

Parameters
No parameters

Request body

application/json
Example Value
Schema
{
  "id": "evt_01aaaaaaaaaaaaaaaaaaaaaaaa",
  "timestamp": 1634567890123,
  "session": "default",
  "metadata": {
    "user.id": "123",
    "user.email": "email@example.com"
  },
  "engine": "WEBJS",
  "event": "message.edited",
  "payload": {
    "id": "false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAA",
    "timestamp": 1666943582,
    "from": "11111111111@c.us",
    "fromMe": true,
    "source": "api",
    "to": "11111111111@c.us",
    "participant": "string",
    "body": "string",
    "hasMedia": true,
    "media": {
      "url": "http://localhost:3000/api/files/false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAA.oga",
      "mimetype": "audio/jpeg",
      "filename": "example.pdf",
      "s3": {
        "Bucket": "my-bucket",
        "Key": "default/false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAA.oga"
      },
      "error": null
    },
    "ack": -1,
    "ackName": "string",
    "author": "string",
    "location": {
      "description": "string",
      "latitude": "string",
      "longitude": "string"
    },
    "vCards": [
      "string"
    ],
    "_data": {},
    "editedMessageId": "A06CA7BB5DD8C8F705628CDB7E3A33C9",
    "replyTo": {
      "id": "AAAAAAAAAAAAAAAAAAAA",
      "participant": "11111111111@c.us",
      "body": "Hello!",
      "_data": {}
    }
  },
  "me": {
    "id": "11111111111@c.us",
    "lid": "123123@lid",
    "jid": "123123:123@s.whatsapp.net",
    "pushName": "string"
  },
  "environment": {
    "version": "YYYY.MM.BUILD",
    "engine": "WEBJS",
    "tier": "PLUS",
    "browser": "/usr/path/to/bin/google-chrome"
  }
}
Responses
Code	Description	Links
200	
Return a 200 status to indicate that the data was received successfully

No links

POST
group.v2.join
When you joined or were added to a group

Parameters
No parameters

Request body

application/json
Example Value
Schema
{
  "id": "evt_01aaaaaaaaaaaaaaaaaaaaaaaa",
  "timestamp": 1634567890123,
  "session": "default",
  "metadata": {
    "user.id": "123",
    "user.email": "email@example.com"
  },
  "engine": "WEBJS",
  "event": "group.v2.join",
  "payload": {
    "timestamp": 1666943582,
    "group": {
      "id": "123456789@g.us",
      "subject": "Group Name",
      "description": "Group Description",
      "invite": "https://chat.whatsapp.com/1234567890abcdef",
      "membersCanAddNewMember": true,
      "membersCanSendMessages": true,
      "newMembersApprovalRequired": true,
      "participants": [
        {
          "id": "123456789@c.us",
          "role": "participant"
        }
      ]
    },
    "_data": {}
  },
  "me": {
    "id": "11111111111@c.us",
    "lid": "123123@lid",
    "jid": "123123:123@s.whatsapp.net",
    "pushName": "string"
  },
  "environment": {
    "version": "YYYY.MM.BUILD",
    "engine": "WEBJS",
    "tier": "PLUS",
    "browser": "/usr/path/to/bin/google-chrome"
  }
}
Responses
Code	Description	Links
200	
Return a 200 status to indicate that the data was received successfully

No links

POST
group.v2.leave
When you left or were removed from a group

Parameters
No parameters

Request body

application/json
Example Value
Schema
{
  "id": "evt_01aaaaaaaaaaaaaaaaaaaaaaaa",
  "timestamp": 1634567890123,
  "session": "default",
  "metadata": {
    "user.id": "123",
    "user.email": "email@example.com"
  },
  "engine": "WEBJS",
  "event": "group.v2.leave",
  "payload": {
    "timestamp": 1666943582,
    "group": {
      "id": "123456789@g.us"
    },
    "_data": {}
  },
  "me": {
    "id": "11111111111@c.us",
    "lid": "123123@lid",
    "jid": "123123:123@s.whatsapp.net",
    "pushName": "string"
  },
  "environment": {
    "version": "YYYY.MM.BUILD",
    "engine": "WEBJS",
    "tier": "PLUS",
    "browser": "/usr/path/to/bin/google-chrome"
  }
}
Responses
Code	Description	Links
200	
Return a 200 status to indicate that the data was received successfully

No links

POST
group.v2.update
When group info is updated

Parameters
No parameters

Request body

application/json
Example Value
Schema
{
  "id": "evt_01aaaaaaaaaaaaaaaaaaaaaaaa",
  "timestamp": 1634567890123,
  "session": "default",
  "metadata": {
    "user.id": "123",
    "user.email": "email@example.com"
  },
  "engine": "WEBJS",
  "event": "group.v2.update",
  "payload": {
    "timestamp": 1666943582,
    "group": {},
    "_data": {}
  },
  "me": {
    "id": "11111111111@c.us",
    "lid": "123123@lid",
    "jid": "123123:123@s.whatsapp.net",
    "pushName": "string"
  },
  "environment": {
    "version": "YYYY.MM.BUILD",
    "engine": "WEBJS",
    "tier": "PLUS",
    "browser": "/usr/path/to/bin/google-chrome"
  }
}
Responses
Code	Description	Links
200	
Return a 200 status to indicate that the data was received successfully

No links

POST
group.v2.participants
When participants changed - join, leave, promote to admin

Parameters
No parameters

Request body

application/json
Example Value
Schema
{
  "id": "evt_01aaaaaaaaaaaaaaaaaaaaaaaa",
  "timestamp": 1634567890123,
  "session": "default",
  "metadata": {
    "user.id": "123",
    "user.email": "email@example.com"
  },
  "engine": "WEBJS",
  "event": "group.v2.participants",
  "payload": {
    "type": "join",
    "timestamp": 1666943582,
    "group": {
      "id": "123456789@g.us"
    },
    "participants": [
      {
        "id": "123456789@c.us",
        "role": "participant"
      }
    ],
    "_data": {}
  },
  "me": {
    "id": "11111111111@c.us",
    "lid": "123123@lid",
    "jid": "123123:123@s.whatsapp.net",
    "pushName": "string"
  },
  "environment": {
    "version": "YYYY.MM.BUILD",
    "engine": "WEBJS",
    "tier": "PLUS",
    "browser": "/usr/path/to/bin/google-chrome"
  }
}
Responses
Code	Description	Links
200	
Return a 200 status to indicate that the data was received successfully

No links

POST
presence.update
The most recent presence information for a chat.

Parameters
No parameters

Request body

application/json
Example Value
Schema
{
  "id": "evt_01aaaaaaaaaaaaaaaaaaaaaaaa",
  "timestamp": 1634567890123,
  "session": "default",
  "metadata": {
    "user.id": "123",
    "user.email": "email@example.com"
  },
  "engine": "WEBJS",
  "event": "presence.update",
  "payload": {
    "id": "11111111111@c.us",
    "presences": [
      {
        "participant": "11111111111@c.us",
        "lastSeen": 1686568773,
        "lastKnownPresence": "offline"
      }
    ]
  },
  "me": {
    "id": "11111111111@c.us",
    "lid": "123123@lid",
    "jid": "123123:123@s.whatsapp.net",
    "pushName": "string"
  },
  "environment": {
    "version": "YYYY.MM.BUILD",
    "engine": "WEBJS",
    "tier": "PLUS",
    "browser": "/usr/path/to/bin/google-chrome"
  }
}
Responses
Code	Description	Links
200	
Return a 200 status to indicate that the data was received successfully

No links

POST
poll.vote
With this event, you receive new votes for the poll sent.

Parameters
No parameters

Request body

application/json
Example Value
Schema
{
  "id": "evt_01aaaaaaaaaaaaaaaaaaaaaaaa",
  "timestamp": 1634567890123,
  "session": "default",
  "metadata": {
    "user.id": "123",
    "user.email": "email@example.com"
  },
  "engine": "WEBJS",
  "event": "poll.vote",
  "payload": {
    "vote": {
      "id": "false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAA",
      "selectedOptions": [
        "Awesome!"
      ],
      "timestamp": 1692861369,
      "to": "string",
      "from": "string",
      "fromMe": true,
      "participant": "string"
    },
    "poll": {
      "id": "false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAA",
      "to": "string",
      "from": "string",
      "fromMe": true,
      "participant": "string"
    },
    "_data": {}
  },
  "me": {
    "id": "11111111111@c.us",
    "lid": "123123@lid",
    "jid": "123123:123@s.whatsapp.net",
    "pushName": "string"
  },
  "environment": {
    "version": "YYYY.MM.BUILD",
    "engine": "WEBJS",
    "tier": "PLUS",
    "browser": "/usr/path/to/bin/google-chrome"
  }
}
Responses
Code	Description	Links
200	
Return a 200 status to indicate that the data was received successfully

No links

POST
poll.vote.failed
There may be cases when it fails to decrypt a vote from the user. Read more about how to handle such events in the documentations.

Parameters
No parameters

Request body

application/json
Example Value
Schema
{
  "id": "evt_01aaaaaaaaaaaaaaaaaaaaaaaa",
  "timestamp": 1634567890123,
  "session": "default",
  "metadata": {
    "user.id": "123",
    "user.email": "email@example.com"
  },
  "engine": "WEBJS",
  "event": "poll.vote.failed",
  "payload": {
    "vote": {
      "id": "false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAA",
      "selectedOptions": [
        "Awesome!"
      ],
      "timestamp": 1692861369,
      "to": "string",
      "from": "string",
      "fromMe": true,
      "participant": "string"
    },
    "poll": {
      "id": "false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAA",
      "to": "string",
      "from": "string",
      "fromMe": true,
      "participant": "string"
    },
    "_data": {}
  },
  "me": {
    "id": "11111111111@c.us",
    "lid": "123123@lid",
    "jid": "123123:123@s.whatsapp.net",
    "pushName": "string"
  },
  "environment": {
    "version": "YYYY.MM.BUILD",
    "engine": "WEBJS",
    "tier": "PLUS",
    "browser": "/usr/path/to/bin/google-chrome"
  }
}
Responses
Code	Description	Links
200	
Return a 200 status to indicate that the data was received successfully

No links

POST
chat.archive
The event is triggered when the chat is archived or unarchived

Parameters
No parameters

Request body

application/json
Example Value
Schema
{
  "id": "evt_01aaaaaaaaaaaaaaaaaaaaaaaa",
  "timestamp": 1634567890123,
  "session": "default",
  "metadata": {
    "user.id": "123",
    "user.email": "email@example.com"
  },
  "engine": "WEBJS",
  "event": "chat.archive",
  "payload": {
    "id": "11111111111@c.us",
    "archived": true,
    "timestamp": 0
  },
  "me": {
    "id": "11111111111@c.us",
    "lid": "123123@lid",
    "jid": "123123:123@s.whatsapp.net",
    "pushName": "string"
  },
  "environment": {
    "version": "YYYY.MM.BUILD",
    "engine": "WEBJS",
    "tier": "PLUS",
    "browser": "/usr/path/to/bin/google-chrome"
  }
}
Responses
Code	Description	Links
200	
Return a 200 status to indicate that the data was received successfully

No links

POST
call.received
The event is triggered when the call is received by the user.

Parameters
No parameters

Request body

application/json
Example Value
Schema
{
  "id": "evt_01aaaaaaaaaaaaaaaaaaaaaaaa",
  "timestamp": 1634567890123,
  "session": "default",
  "metadata": {
    "user.id": "123",
    "user.email": "email@example.com"
  },
  "engine": "WEBJS",
  "event": "call.received",
  "payload": {
    "id": "ABCDEFGABCDEFGABCDEFGABCDEFG",
    "from": "11111111111@c.us",
    "timestamp": 0,
    "isVideo": true,
    "isGroup": true
  },
  "me": {
    "id": "11111111111@c.us",
    "lid": "123123@lid",
    "jid": "123123:123@s.whatsapp.net",
    "pushName": "string"
  },
  "environment": {
    "version": "YYYY.MM.BUILD",
    "engine": "WEBJS",
    "tier": "PLUS",
    "browser": "/usr/path/to/bin/google-chrome"
  }
}
Responses
Code	Description	Links
200	
Return a 200 status to indicate that the data was received successfully

No links

POST
call.accepted
The event is triggered when the call is accepted by the user.

Parameters
No parameters

Request body

application/json
Example Value
Schema
{
  "id": "evt_01aaaaaaaaaaaaaaaaaaaaaaaa",
  "timestamp": 1634567890123,
  "session": "default",
  "metadata": {
    "user.id": "123",
    "user.email": "email@example.com"
  },
  "engine": "WEBJS",
  "event": "call.accepted",
  "payload": {
    "id": "ABCDEFGABCDEFGABCDEFGABCDEFG",
    "from": "11111111111@c.us",
    "timestamp": 0,
    "isVideo": true,
    "isGroup": true
  },
  "me": {
    "id": "11111111111@c.us",
    "lid": "123123@lid",
    "jid": "123123:123@s.whatsapp.net",
    "pushName": "string"
  },
  "environment": {
    "version": "YYYY.MM.BUILD",
    "engine": "WEBJS",
    "tier": "PLUS",
    "browser": "/usr/path/to/bin/google-chrome"
  }
}
Responses
Code	Description	Links
200	
Return a 200 status to indicate that the data was received successfully

No links

POST
call.rejected
The event is triggered when the call is rejected by the user.

Parameters
No parameters

Request body

application/json
Example Value
Schema
{
  "id": "evt_01aaaaaaaaaaaaaaaaaaaaaaaa",
  "timestamp": 1634567890123,
  "session": "default",
  "metadata": {
    "user.id": "123",
    "user.email": "email@example.com"
  },
  "engine": "WEBJS",
  "event": "call.rejected",
  "payload": {
    "id": "ABCDEFGABCDEFGABCDEFGABCDEFG",
    "from": "11111111111@c.us",
    "timestamp": 0,
    "isVideo": true,
    "isGroup": true
  },
  "me": {
    "id": "11111111111@c.us",
    "lid": "123123@lid",
    "jid": "123123:123@s.whatsapp.net",
    "pushName": "string"
  },
  "environment": {
    "version": "YYYY.MM.BUILD",
    "engine": "WEBJS",
    "tier": "PLUS",
    "browser": "/usr/path/to/bin/google-chrome"
  }
}
Responses
Code	Description	Links
200	
Return a 200 status to indicate that the data was received successfully

No links

POST
label.upsert
The event is triggered when a label is created or updated

Parameters
No parameters

Request body

application/json
Example Value
Schema
{
  "id": "evt_01aaaaaaaaaaaaaaaaaaaaaaaa",
  "timestamp": 1634567890123,
  "session": "default",
  "metadata": {
    "user.id": "123",
    "user.email": "email@example.com"
  },
  "engine": "WEBJS",
  "event": "label.upsert",
  "payload": {
    "id": "1",
    "name": "Lead",
    "color": 0,
    "colorHex": "#ff9485"
  },
  "me": {
    "id": "11111111111@c.us",
    "lid": "123123@lid",
    "jid": "123123:123@s.whatsapp.net",
    "pushName": "string"
  },
  "environment": {
    "version": "YYYY.MM.BUILD",
    "engine": "WEBJS",
    "tier": "PLUS",
    "browser": "/usr/path/to/bin/google-chrome"
  }
}
Responses
Code	Description	Links
200	
Return a 200 status to indicate that the data was received successfully

No links

POST
label.deleted
The event is triggered when a label is deleted

Parameters
No parameters

Request body

application/json
Example Value
Schema
{
  "id": "evt_01aaaaaaaaaaaaaaaaaaaaaaaa",
  "timestamp": 1634567890123,
  "session": "default",
  "metadata": {
    "user.id": "123",
    "user.email": "email@example.com"
  },
  "engine": "WEBJS",
  "event": "label.deleted",
  "payload": {
    "id": "1",
    "name": "Lead",
    "color": 0,
    "colorHex": "#ff9485"
  },
  "me": {
    "id": "11111111111@c.us",
    "lid": "123123@lid",
    "jid": "123123:123@s.whatsapp.net",
    "pushName": "string"
  },
  "environment": {
    "version": "YYYY.MM.BUILD",
    "engine": "WEBJS",
    "tier": "PLUS",
    "browser": "/usr/path/to/bin/google-chrome"
  }
}
Responses
Code	Description	Links
200	
Return a 200 status to indicate that the data was received successfully

No links

POST
label.chat.added
The event is triggered when a label is added to a chat

Parameters
No parameters

Request body

application/json
Example Value
Schema
{
  "id": "evt_01aaaaaaaaaaaaaaaaaaaaaaaa",
  "timestamp": 1634567890123,
  "session": "default",
  "metadata": {
    "user.id": "123",
    "user.email": "email@example.com"
  },
  "engine": "WEBJS",
  "event": "label.chat.added",
  "payload": {
    "labelId": "1",
    "chatId": "11111111111@c.us",
    "label": {
      "id": "1",
      "name": "Lead",
      "color": 0,
      "colorHex": "#ff9485"
    }
  },
  "me": {
    "id": "11111111111@c.us",
    "lid": "123123@lid",
    "jid": "123123:123@s.whatsapp.net",
    "pushName": "string"
  },
  "environment": {
    "version": "YYYY.MM.BUILD",
    "engine": "WEBJS",
    "tier": "PLUS",
    "browser": "/usr/path/to/bin/google-chrome"
  }
}
Responses
Code	Description	Links
200	
Return a 200 status to indicate that the data was received successfully

No links

POST
label.chat.deleted
The event is triggered when a label is deleted from a chat

Parameters
No parameters

Request body

application/json
Example Value
Schema
{
  "id": "evt_01aaaaaaaaaaaaaaaaaaaaaaaa",
  "timestamp": 1634567890123,
  "session": "default",
  "metadata": {
    "user.id": "123",
    "user.email": "email@example.com"
  },
  "engine": "WEBJS",
  "event": "label.chat.deleted",
  "payload": {
    "labelId": "1",
    "chatId": "11111111111@c.us",
    "label": {
      "id": "1",
      "name": "Lead",
      "color": 0,
      "colorHex": "#ff9485"
    }
  },
  "me": {
    "id": "11111111111@c.us",
    "lid": "123123@lid",
    "jid": "123123:123@s.whatsapp.net",
    "pushName": "string"
  },
  "environment": {
    "version": "YYYY.MM.BUILD",
    "engine": "WEBJS",
    "tier": "PLUS",
    "browser": "/usr/path/to/bin/google-chrome"
  }
}
Responses
Code	Description	Links
200	
Return a 200 status to indicate that the data was received successfully

No links

POST
event.response
The event is triggered when the event response is received.

Parameters
No parameters

Request body

application/json
Example Value
Schema
{
  "id": "evt_01aaaaaaaaaaaaaaaaaaaaaaaa",
  "timestamp": 1634567890123,
  "session": "default",
  "metadata": {
    "user.id": "123",
    "user.email": "email@example.com"
  },
  "engine": "WEBJS",
  "event": "event.response",
  "payload": {
    "id": "false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAA",
    "timestamp": 1666943582,
    "from": "11111111111@c.us",
    "fromMe": true,
    "source": "api",
    "to": "11111111111@c.us",
    "participant": "string",
    "_data": {},
    "eventCreationKey": {
      "id": "false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAA",
      "to": "string",
      "from": "string",
      "fromMe": true,
      "participant": "string"
    },
    "eventResponse": {
      "response": "UNKNOWN",
      "timestampMs": 0,
      "extraGuestCount": 0
    }
  },
  "me": {
    "id": "11111111111@c.us",
    "lid": "123123@lid",
    "jid": "123123:123@s.whatsapp.net",
    "pushName": "string"
  },
  "environment": {
    "version": "YYYY.MM.BUILD",
    "engine": "WEBJS",
    "tier": "PLUS",
    "browser": "/usr/path/to/bin/google-chrome"
  }
}
Responses
Code	Description	Links
200	
Return a 200 status to indicate that the data was received successfully

No links

POST
event.response.failed
The event is triggered when the event response is failed to decrypt.

Parameters
No parameters

Request body

application/json
Example Value
Schema
{
  "id": "evt_01aaaaaaaaaaaaaaaaaaaaaaaa",
  "timestamp": 1634567890123,
  "session": "default",
  "metadata": {
    "user.id": "123",
    "user.email": "email@example.com"
  },
  "engine": "WEBJS",
  "event": "event.response.failed",
  "payload": {
    "id": "false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAA",
    "timestamp": 1666943582,
    "from": "11111111111@c.us",
    "fromMe": true,
    "source": "api",
    "to": "11111111111@c.us",
    "participant": "string",
    "_data": {},
    "eventCreationKey": {
      "id": "false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAA",
      "to": "string",
      "from": "string",
      "fromMe": true,
      "participant": "string"
    },
    "eventResponse": {
      "response": "UNKNOWN",
      "timestampMs": 0,
      "extraGuestCount": 0
    }
  },
  "me": {
    "id": "11111111111@c.us",
    "lid": "123123@lid",
    "jid": "123123:123@s.whatsapp.net",
    "pushName": "string"
  },
  "environment": {
    "version": "YYYY.MM.BUILD",
    "engine": "WEBJS",
    "tier": "PLUS",
    "browser": "/usr/path/to/bin/google-chrome"
  }
}
Responses
Code	Description	Links
200	
Return a 200 status to indicate that the data was received successfully

No links

POST
engine.event
Internal engine event.

Parameters
No parameters

Request body

application/json
Example Value
Schema
{
  "id": "evt_01aaaaaaaaaaaaaaaaaaaaaaaa",
  "timestamp": 1634567890123,
  "session": "default",
  "metadata": {
    "user.id": "123",
    "user.email": "email@example.com"
  },
  "engine": "WEBJS",
  "event": "engine.event",
  "payload": {
    "event": "string",
    "data": {}
  },
  "me": {
    "id": "11111111111@c.us",
    "lid": "123123@lid",
    "jid": "123123:123@s.whatsapp.net",
    "pushName": "string"
  },
  "environment": {
    "version": "YYYY.MM.BUILD",
    "engine": "WEBJS",
    "tier": "PLUS",
    "browser": "/usr/path/to/bin/google-chrome"
  }
}
Responses
Code	Description	Links
200	
Return a 200 status to indicate that the data was received successfully

No links

POST
group.join
Some one join a group.


POST
group.leave
Some one left a group.


POST
state.change
It’s an internal engine’s state, not session status.


