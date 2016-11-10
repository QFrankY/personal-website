const router = require('express').Router();
const md5    = require('crypto-js/md5');

const chatter        = require('./chatter-socket').chatter;
const chatterSockets = require('./chatter-socket').chatterSockets;
const getRoomList    = require('./chatter-socket').getRoomList;
const dev            = require('../utils').Dev('chatter:room');
const getSocket      = require('../../socket').getSocket;

const Room = require('./mongo').Room;

/**
 * Room related APIs
 */

/** Get all available rooms */
router.get('/rooms', function (req, res) {
	dev.log('Successfully fetched rooms');
	res.status(200).send({ rooms: getRoomList() });
});

/** Join rooms */
router.get('/join/:room/:id?', function (req, res) {
	var socket  = getSocket(req, chatterSockets);
	var room    = req.params.room;
	var roomId  = req.params.id;

	console.log(!req.session.user);

	if (!req.session.user) {
		res.status(500).send("No request session information");
	}

	if (room.length > 20) {
		res.status(500).send({ msg: 'Room name too long.' });
	} else if (roomId) {
		Room.findOneAndUpdate({
			name : room,
			id   : roomId
		}, {
			$push: {
				users: {
					id       : req.session.user.id,
					socket   : req.headers['socket-id'],
					name     : req.session.user.name,
					imageNum : req.session.user.imageNum
				}
			}
		}, {
			new: true
		}, function (err, _room) {
			if (!_room) {
				dev.err('Failed to join room: ' + room + ' does not exist');
				res.status(500).send({ msg: 'Failed to join room: ' + room + ' does not exist' });
			} else {
				socket.join('room_' + _room.name + _room.id);
				dev.log(req.session.user.name + ' successfully joined chatter room: ' + room);
				chatter.emit('newUser', {
					id       : req.session.user.id,
					roomId   : _room.id,
					name     : req.session.user.name,
					imageNum : req.session.user.imageNum
				});
				res.status(200).send({
					id   : _room.id,
					name : _room.name
				});
			}
		});
	} else {
		Room.create({
			name  : room,
			id    : md5(room + new Date().getTime()).toString(),
			users : [{
				id       : req.session.user.id,
				socket   : req.headers['socket-id'],
				name     : req.session.user.name,
				imageNum : req.session.user.imageNum
			}]
		}, function (err, _room) {
			if (err) {
				res.status(500).send({ msg: 'Failed to create room. Try again later.' });
			} else {
				socket.join('room_' + _room.name + _room.id);
				chatter.emit('newRoom', {
					numConnections : 1,
					name           : _room.name,
					id             : _room.id
				});
				dev.log(req.session.user.name + ' successfully created chatter room: ' + room);
				res.status(200).send({
					id   : _room.id,
					name : _room.name
				});
			}
		});
	}
});

/** Get users in a room */
router.get('/room/users/:room', function (req, res) {
	Room.findOne({
		name: req.params.room
	}, {
		"users.imageNum" : 1,
		"users.name"     : 1,
		"users.id"       : 1
	}, function (err, room) {
		if (err) {
			res.status(500).send({ msg: err });
		} else {
			res.status(200).send({ users: room.users });
		}
	});
});

module.exports = router;