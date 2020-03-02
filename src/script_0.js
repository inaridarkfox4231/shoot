p5.DisableFriendlyErrors = true;
"use strict";

// とりあえずどうする？？
// いろんなバリエーションがあると思う。
// パターン1:テストモード。
// 自由にボールを追加、削除できるようにし、どのボールも引っ張って動かせるようにする。
// その際、追加するボールの質量、摩擦係数、などをいじれるようにした方がいいかも。
//
// 摩擦係数は0.005～0.045くらいで（適当）
// 速さの下限は0.001～0.1くらいで動かしてみる。

let balls = [];
const AREA_WIDTH =  360;
const AREA_HEIGHT = 500;
const BALL_RADIUS = AREA_WIDTH * 0.05;
const FRICTION_COEFFICIENT = 0.01; // 摩擦の大きさ
const SPEED_LOWER_LIMIT = 0.1; // 速さの下限（これ以下になったら0として扱う）

const BALL_COLOR_PALLETE = ["#0000EE"];

function setup(){
	createCanvas(AREA_WIDTH, AREA_HEIGHT);
	noStroke();
	angleMode(DEGREES);
	balls.push(new Ball(100, 200));
	balls[0].setVelocity(16, 245);
	balls.push(new Ball(240, 200));
	balls[1].setVelocity(8, 83);
}

function draw(){
	background(220);
	for(let b of balls){ b.update(); }
	for(let ballId = 0; ballId < balls.length; ballId++){
		const _ball = balls[ballId];
		for(let otherId = ballId + 1; otherId < balls.length; otherId++){
			const _other = balls[otherId];
			if(!collisionCheck(_ball, _other)){ continue; }
			perfectCollision(_ball, _other);
		}
	}
	for(let b of balls){ b.draw(); }
}

class Ball{
	constructor(x, y, colorId = 0, mf = 1.0){
		this.position = createVector(x, y);
		this.velocity = createVector(0, 0);
		this.massFactor = mf;
		this.radius = BALL_RADIUS;
		this.friction = FRICTION_COEFFICIENT;
		this.color = BALL_COLOR_PALLETE[colorId];
	}
	setVelocity(speed, direction){
		this.velocity.set(speed * cos(direction), speed * sin(direction));
	}
	applyReflection(){
		if(this.position.x < this.radius || this.position.x > AREA_WIDTH - this.radius){
			this.velocity = reflection(this.velocity, createVector(1, 0));
		}else if(this.position.y < this.radius || this.position.y > AREA_HEIGHT - this.radius){
			this.velocity = reflection(this.velocity, createVector(0, 1));
		}
	}
	applyFriction(){
		// 摩擦を与える
		this.velocity.mult(1 - this.friction);
	}
	update(){
		this.position.add(this.velocity);
		this.applyReflection();
		this.applyFriction();
		if(this.velocity.mag() < SPEED_LOWER_LIMIT){ this.velocity.set(0, 0); }
	}
	draw(){
		fill(this.color);
		circle(this.position.x, this.position.y, this.radius * 2);
	}
}

function collisionCheck(_ball, _other){
  return p5.Vector.dist(_ball.position, _other.position) < _ball.radius + _other.radius;
}

// まずball.massFactorとball.velocityとotherのそれから重心のベクトルを出してそれを使って相対速度を作って
// それに対して衝突面の法線ベクトル、これはpositionのsubを取るだけ。これで相対速度を反射させる。
// 最後に重心ベクトルを足しなおせば完成（のはず）
function perfectCollision(_ball, _other){
	// ballとotherが衝突したときの速度の変化を記述する（面倒なので完全弾性衝突で）
	// 重心ベクトル
	const g = getCenterVector(_ball, _other);
	// 相対速度
	let u = p5.Vector.sub(_ball.velocity, g);
	let v = p5.Vector.sub(_other.velocity, g);
	const collisionPlaneNormalVector = p5.Vector.sub(_ball.position, _other.position);
	u = reflection(u, collisionPlaneNormalVector);
	v = reflection(v, collisionPlaneNormalVector);
	_ball.velocity = p5.Vector.add(u, g);
	_other.velocity = p5.Vector.add(v, g);
}

function getCenterVector(_ball, _other){
  const multiplier = 1 / (_ball.massFactor + _other.massFactor);
	const u = p5.Vector.mult(_ball.velocity, _ball.massFactor);
	const v = p5.Vector.mult(_other.velocity, _other.massFactor);
	return p5.Vector.mult(p5.Vector.add(u, v), multiplier);
}

function reflection(v, e){
	// eは壁の法線ベクトル(normalVector)。これにより反射させる。
	// eとして、v→v - 2(v・e)eという計算を行う。
	// eが単位ベクトルでもいいように大きさの2乗（e・e）で割るか・・（collisionでも使うので）
	return p5.Vector.sub(v, p5.Vector.mult(p5.Vector.mult(e, 2), p5.Vector.dot(v, e) / p5.Vector.dot(e, e)));
}
