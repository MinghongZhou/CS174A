// *******************************************************
// CS 174a Graphics Example Code
// animation.js - The main file and program start point.  The class definition here describes how to display an Animation and how it will react to key and mouse input.  Right now it has
// very little in it - you will fill it in with all your shape drawing calls and any extra key / mouse controls.

// Now go down to display() to see where the sample shapes are drawn, and to see where to fill in your own code.

"use strict"
var canvas, canvas_size, gl = null, g_addrs,
movement = vec2(),	thrust = vec3(), 	looking = false, prev_time = 0, animate = false, animation_time = 0;
var gouraud = false, color_normals = false, solid = false;
function CURRENT_BASIS_IS_WORTH_SHOWING(self, model_transform) { self.m_axis.draw( self.basis_id++, self.graphicsState, model_transform, new Material( vec4( .8,.3,.8,1 ), .5, 1, 1, 40, "" ) ); }


// *******************************************************
// IMPORTANT -- In the line below, add the filenames of any new images you want to include for textures!

var texture_filenames_to_load = [ "stars.png", "text.png", "earth.gif", "crowd.png", "fire.png" ];

// *******************************************************
// When the web page's window loads it creates an "Animation" object.  It registers itself as a displayable object to our other class "GL_Context" -- which OpenGL is told to call upon every time a
// draw / keyboard / mouse event happens.

window.onload = function init() {	var anim = new Animation();	}
function Animation()
{
    ( function init (self)
     {
     self.context = new GL_Context( "gl-canvas" );
     self.context.register_display_object( self );
     
     gl.clearColor( 1, 1, 1, 1 );			// Background color
     
     for( var i = 0; i < texture_filenames_to_load.length; i++ )
     initTexture( texture_filenames_to_load[i], true );
     
     self.m_cube = new cube();
     self.m_obj = new shape_from_file( "teapot.obj" )
     self.m_axis = new axis();
     self.m_sphere = new sphere( mat4(), 4 );
     self.m_fan = new triangle_fan_full( 10, mat4() );
     self.m_strip = new rectangular_strip( 1, mat4() );
     self.m_cylinder = new cylindrical_strip( 20, mat4() );
     self.m_fire = new triangle_p();
     
     // 1st parameter is camera matrix.  2nd parameter is the projection:  The matrix that determines how depth is treated.  It projects 3D points onto a plane.
     self.graphicsState = new GraphicsState( translation(0, 0,-40), perspective(45, canvas.width/canvas.height, .1, 1000), 0 );
     
     gl.uniform1i( g_addrs.GOURAUD_loc, gouraud);		gl.uniform1i( g_addrs.COLOR_NORMALS_loc, color_normals);		gl.uniform1i( g_addrs.SOLID_loc, solid);
     
     self.context.render();
     } ) ( this );
    
    canvas.addEventListener('mousemove', function(e)	{		e = e || window.event;		movement = vec2( e.clientX - canvas.width/2, e.clientY - canvas.height/2, 0);	});
}

// *******************************************************
// init_keys():  Define any extra keyboard shortcuts here
Animation.prototype.init_keys = function()
{
    shortcut.add( "Space", function() { thrust[1] = -3; } );			shortcut.add( "Space", function() { thrust[1] =  0; }, {'type':'keyup'} );
    shortcut.add( "z",     function() { thrust[1] =  3; } );			shortcut.add( "z",     function() { thrust[1] =  0; }, {'type':'keyup'} );
    shortcut.add( "w",     function() { thrust[2] =  3; } );			shortcut.add( "w",     function() { thrust[2] =  0; }, {'type':'keyup'} );
    shortcut.add( "a",     function() { thrust[0] =  3; } );			shortcut.add( "a",     function() { thrust[0] =  0; }, {'type':'keyup'} );
    shortcut.add( "s",     function() { thrust[2] = -3; } );			shortcut.add( "s",     function() { thrust[2] =  0; }, {'type':'keyup'} );
    shortcut.add( "d",     function() { thrust[0] = -3; } );			shortcut.add( "d",     function() { thrust[0] =  0; }, {'type':'keyup'} );
    shortcut.add( "f",     function() { looking = !looking; } );
    shortcut.add( ",",     ( function(self) { return function() { self.graphicsState.camera_transform = mult( rotation( 3, 0, 0,  1 ), self.graphicsState.camera_transform ); }; } ) (this) ) ;
    shortcut.add( ".",     ( function(self) { return function() { self.graphicsState.camera_transform = mult( rotation( 3, 0, 0, -1 ), self.graphicsState.camera_transform ); }; } ) (this) ) ;
    
    shortcut.add( "r",     ( function(self) { return function() { self.graphicsState.camera_transform = mat4(); }; } ) (this) );
    shortcut.add( "ALT+s", function() { solid = !solid;					gl.uniform1i( g_addrs.SOLID_loc, solid);
                 gl.uniform4fv( g_addrs.SOLID_COLOR_loc, vec4(Math.random(), Math.random(), Math.random(), 1) );	 } );
    shortcut.add( "ALT+g", function() { gouraud = !gouraud;				gl.uniform1i( g_addrs.GOURAUD_loc, gouraud);	} );
    shortcut.add( "ALT+n", function() { color_normals = !color_normals;	gl.uniform1i( g_addrs.COLOR_NORMALS_loc, color_normals);	} );
    shortcut.add( "ALT+a", function() { animate = !animate; } );
    
    shortcut.add( "p",     ( function(self) { return function() { self.m_axis.basis_selection++; console.log("Selected Basis: " + self.m_axis.basis_selection ); }; } ) (this) );
    shortcut.add( "m",     ( function(self) { return function() { self.m_axis.basis_selection--; console.log("Selected Basis: " + self.m_axis.basis_selection ); }; } ) (this) );
}

function update_camera( self, animation_delta_time )
{
    var leeway = 70, border = 50;
    var degrees_per_frame = .0002 * animation_delta_time;
    var meters_per_frame  = .01 * animation_delta_time;
    // Determine camera rotation movement first
    var movement_plus  = [ movement[0] + leeway, movement[1] + leeway ];		// movement[] is mouse position relative to canvas center; leeway is a tolerance from the center.
    var movement_minus = [ movement[0] - leeway, movement[1] - leeway ];
    var outside_border = false;
    
    for( var i = 0; i < 2; i++ )
        if ( Math.abs( movement[i] ) > canvas_size[i]/2 - border )	outside_border = true;		// Stop steering if we're on the outer edge of the canvas.
    
    for( var i = 0; looking && outside_border == false && i < 2; i++ )			// Steer according to "movement" vector, but don't start increasing until outside a leeway window from the center.
    {
        var velocity = ( ( movement_minus[i] > 0 && movement_minus[i] ) || ( movement_plus[i] < 0 && movement_plus[i] ) ) * degrees_per_frame;	// Use movement's quantity unless the &&'s zero it out
        self.graphicsState.camera_transform = mult( rotation( velocity, i, 1-i, 0 ), self.graphicsState.camera_transform );			// On X step, rotate around Y axis, and vice versa.
    }
    self.graphicsState.camera_transform = mult( translation( scale_vec( meters_per_frame, thrust ) ), self.graphicsState.camera_transform );		// Now translation movement of camera, applied in local camera coordinate frame
}

// *******************************************************
// display(): called once per frame, whenever OpenGL decides it's time to redraw.
var purple = new Material( vec4( .3,.1,.9,1 ), .8, .4, .4, 20 ),
yellow = new Material( vec4( .6,.6,.1,1 ), .8, 1, .8, 20 ),
grey = new Material( vec4( .5,.5,.5,1 ), .3, .1, .2, 40 ),
grey2 = new Material( vec4( 1,1,1,1 ), .6, .3, .3, 40 ),
red = new Material( vec4(1, .1, .1, 1), .8, 1, .5, 40),
brown = new Material( vec4(.9, .5, .5, 1), .4, 1, .5, 40),
white = new Material( vec4( 1,1,1,1 ), 1, 1, 1, 40 ),
greenGround = new Material( vec4( .1,.9,.1,1 ), .8, 1, .5, 40 ),
stadiumOutside = new Material( vec4( .1,.3,.7,1 ), .8, 1, .5, 40 ),
crowd = new Material( vec4( .5,.5,.5,1 ), .5, 1, .5, 40, "crowd.png" ),
fire = new Material( vec4( .5,.5,.5,1 ), .8, .8, .8, 40, "fire.png" ),
clearColor = new Material( vec4( .1,.3,.7,1 ), 0, 0, 0, 40 ),
stack = [],
fps =0;;

Animation.prototype.display = function(time)
{
    if(!time) time = 0;
    this.animation_delta_time = time - prev_time;
    if(animate) this.graphicsState.animation_time += this.animation_delta_time;
    prev_time = time;
    
    update_camera( this, this.animation_delta_time );
    
    this.basis_id = 0;
    
    var model_transform = mat4();
    
    // Materials: Declare new ones as needed in every function.
    // 1st parameter:  Color (4 floats in RGBA format), 2nd: Ambient light, 3rd: Diffuse reflectivity, 4th: Specular reflectivity, 5th: Smoothness exponent, 6th: Texture image.
    
    
    /**********************************
     Start coding here!!!!
     **********************************/
    
    
    
    //build background
    model_transform = mult( model_transform, translation( 0, -10, 0) );
    stack.push(model_transform);

    this.drawGround(model_transform);
    this.drawTrack(model_transform);
    this.drawStadium(model_transform);
    
    //set up
    model_transform = mult( model_transform, translation( -58, -11.5, -45) );
    if(this.graphicsState.animation_time < 6000)
        this.scene0(model_transform);
    else if(this.graphicsState.animation_time > 6000 && this.graphicsState.animation_time < 13000)
        this.scene1(model_transform);
    else if(this.graphicsState.animation_time > 13000 && this.graphicsState.animation_time < 25000)
        this.scene2(model_transform);
    else if(this.graphicsState.animation_time > 25000 && this.graphicsState.animation_time < 36000)
        this.scene3(model_transform);
    else if(this.graphicsState.animation_time > 36000 && this.graphicsState.animation_time < 42000)
        this.scene4(model_transform);

}

Animation.prototype.scene0 = function( model_transform )
{
    this.graphicsState.camera_transform = lookAt(vec3(-100- this.graphicsState.animation_time/80, 150 + this.graphicsState.animation_time/100, 0),vec3(0, 0, 0),vec3(0,1,0));
}

Animation.prototype.scene1 = function( model_transform )
{
    this.graphicsState.camera_transform = lookAt(vec3(-58 + this.graphicsState.animation_time/350-6000/350, 0,-33),vec3(-58+ this.graphicsState.animation_time/350-6000/350,0,-34),vec3(0,1,0));
    this.drawPerson(model_transform, red, 10000000);
    model_transform = mult( model_transform, translation( 4, 0, 0) );
    this.drawPerson(model_transform, purple,10000000);
    model_transform = mult( model_transform, translation( 4, 0, 0) );
    this.drawPerson(model_transform, yellow, 10000000);
    model_transform = mult( model_transform, translation( 4, 0, 0) );
    this.drawPerson(model_transform, white, 1000000);
    model_transform = mult( model_transform, translation( 4, 0, 0) );
    this.drawPerson(model_transform, brown, 1000000);
    model_transform = mult( model_transform, translation( 4, 0, 0) );
    this.drawPerson(model_transform, greenGround, 100000000);
}

Animation.prototype.scene2 = function( model_transform )
{
    this.graphicsState.camera_transform = lookAt(vec3(-10 , 0 , -38 + this.graphicsState.animation_time/160 - 13000/160),vec3(-31 , 0 , -38 + this.graphicsState.animation_time/160 - 13000/160),vec3(0,1,0));

    model_transform = mult( model_transform, translation( 0, 0, (1/137)*this.graphicsState.animation_time - 13000/137));
    this.drawPerson(model_transform, red, 137);
    model_transform = mult( model_transform, translation( 0, 0, -(1/137)*this.graphicsState.animation_time + 13000/137));
    
    
    model_transform = mult( model_transform, translation( 0, 0, (1/140)*this.graphicsState.animation_time - 13000/140));
    model_transform = mult( model_transform, translation( 4, 0, 0) );
    this.drawPerson(model_transform, purple,140);
    model_transform = mult( model_transform, translation( 0, 0, -(1/140)*this.graphicsState.animation_time + 13000/140));
    
    
    model_transform = mult( model_transform, translation( 0, 0, (1/165)*this.graphicsState.animation_time - 13000/165));
    model_transform = mult( model_transform, translation( 4, 0, 0) );
    this.drawPerson(model_transform, yellow, 165);
    model_transform = mult( model_transform, translation( 0, 0, -(1/165)*this.graphicsState.animation_time + 13000/165));
    
    
    model_transform = mult( model_transform, translation( 0, 0, (1/150)*this.graphicsState.animation_time - 13000/150));
    model_transform = mult( model_transform, translation( 4, 0, 0) );
    this.drawPerson(model_transform, white, 150);
    model_transform = mult( model_transform, translation( 0, 0, -(1/150)*this.graphicsState.animation_time + 13000/150));
    
    
    model_transform = mult( model_transform, translation( 0, 0, (1/160)*this.graphicsState.animation_time - 13000/160));
    model_transform = mult( model_transform, translation( 4, 0, 0) );
    this.drawPerson(model_transform, brown, 180);
    model_transform = mult( model_transform, translation( 0, 0, -(1/160)*this.graphicsState.animation_time + 13000/160));
    

    model_transform = mult( model_transform, translation( 0, 0, (1/180)*this.graphicsState.animation_time - 13000/180));
    model_transform = mult( model_transform, translation( 4, 0, 0) );
    this.drawPerson(model_transform, greenGround, 180);
    model_transform = mult( model_transform, translation( 0, 0, -(1/180)*this.graphicsState.animation_time + 13000/180));
}


Animation.prototype.scene3 = function( model_transform )
{
    this.graphicsState.camera_transform = lookAt(vec3(-35 , -3 , 45 ),vec3(-40 , -3 , 45),vec3(0,1,0));
    model_transform = mult( model_transform, translation( 0, .5, 38) );
    
    model_transform = mult( model_transform, translation( 0, 0, 43 + (1/1000)*this.graphicsState.animation_time - 25000/1000));
    this.drawPerson(model_transform, red, 1200);
    model_transform = mult( model_transform, translation( 0, 0, -43 - (1/1000)*this.graphicsState.animation_time + 25000/1000));
    
    
    model_transform = mult( model_transform, translation( 0, 0, 43 + (1/1200)*this.graphicsState.animation_time - 25000/1200));
    model_transform = mult( model_transform, translation( 4, 0, 0) );
    this.drawPerson(model_transform, purple,1200);
    model_transform = mult( model_transform, translation( 0, 0, -43 - (1/1200)*this.graphicsState.animation_time + 25000/1200));
}

Animation.prototype.scene4 = function( model_transform )
{
    this.graphicsState.camera_transform = lookAt(vec3(-40 , 3 , 0 ),vec3(0 , 0 , 0),vec3(0,1,0));
    model_transform= stack.pop();
    model_transform = mult( model_transform, scale( 10, 20, 10 ) );
    this.m_cube.draw( this.graphicsState, model_transform, grey2 );
    model_transform = mult( model_transform, scale( 1/10, 1/20, 1/10 ) );
    model_transform = mult( model_transform, rotation(-90, 0,1,0));
    model_transform = mult( model_transform, translation( 0,-2.5, 0) );
    this.drawPerson(model_transform, red,100000000);
    model_transform = mult( model_transform, translation( 0,2.5, 0) );
    model_transform = mult( model_transform, rotation(90, 0,1,0));
    model_transform = mult( model_transform, translation( -5,5, 0) );
    model_transform = mult( model_transform, scale( 1, 4, 1 ) );
    this.m_cube.draw( this.graphicsState, model_transform, red );
    model_transform = mult( model_transform, scale( 1, 1/4, 1 ) );
    model_transform = mult( model_transform, translation( 5,-5, 0) );


    model_transform = mult( model_transform, translation( 0,0, 10) );
    model_transform = mult( model_transform, scale( 10, 15, 10 ) );
    this.m_cube.draw( this.graphicsState, model_transform, grey2 );
    model_transform = mult( model_transform, scale( 1/10, 1/15, 1/10 ) );
    model_transform = mult( model_transform, rotation(-90, 0,1,0));
    model_transform = mult( model_transform, translation( 0,-5, 0) );
    this.drawPerson(model_transform, purple,100000000);
    model_transform = mult( model_transform, translation( 0,5, 0) );
    model_transform = mult( model_transform, rotation(90, 0,1,0));
    model_transform = mult( model_transform, translation( -5,4, 0) );
    model_transform = mult( model_transform, rotation(45, 1,0,0));
    model_transform = mult( model_transform, scale( 1, 3, 1 ) );
    this.m_cube.draw( this.graphicsState, model_transform, red );
    model_transform = mult( model_transform, scale( 1, 1/3, 1 ) );
    model_transform = mult( model_transform, rotation(-45, 1,0,0));
    model_transform = mult( model_transform, translation( 0,1, 0) );
    model_transform = mult( model_transform, scale( 1, 1, 2.5 ) );
    this.m_cube.draw( this.graphicsState, model_transform, red );
    model_transform = mult( model_transform, scale( 1, 1, 1/2.5 ) );
    model_transform = mult( model_transform, translation( 0,-2, 0) );
    model_transform = mult( model_transform, scale( 1, 1, 2.5 ) );
    this.m_cube.draw( this.graphicsState, model_transform, red );
    model_transform = mult( model_transform, scale( 1, 1, 1/2.5 ) );
    model_transform = mult( model_transform, translation( 5,-3, 0) );
    
    model_transform = mult( model_transform, translation( 0, 0, -20) );
    model_transform = mult( model_transform, scale( 10, 10, 10 ) );
    this.m_cube.draw( this.graphicsState, model_transform, grey2 );
    model_transform = mult( model_transform, scale( 1/10, 1/10, 1/10 ) );
    model_transform = mult( model_transform, rotation(-90, 0,1,0));
    model_transform = mult( model_transform, translation( 0,-7.5, 0) );
    this.drawPerson(model_transform, white,100000000);
    model_transform = mult( model_transform, translation( 0,7.5, 0) );
    model_transform = mult( model_transform, rotation(90, 0,1,0));
    model_transform = mult( model_transform, translation( -5,2.5, 1) );
    model_transform = mult( model_transform, scale( 1, 3, 1 ) );
    this.m_cube.draw( this.graphicsState, model_transform, red );
    model_transform = mult( model_transform, scale( 1, 1/3, 1 ) );
    model_transform = mult( model_transform, translation( 0,0, -1) );
    model_transform = mult( model_transform, scale( 1, .5, 2 ) );
    this.m_cube.draw( this.graphicsState, model_transform, red );
    model_transform = mult( model_transform, scale( 1, 2, 1/2 ) );
    model_transform = mult( model_transform, translation( 0,1.25, 0) );
    model_transform = mult( model_transform, scale( 1, .5, 2 ) );
    this.m_cube.draw( this.graphicsState, model_transform, red );
    model_transform = mult( model_transform, scale( 1, 2, 1/2 ) )
    model_transform = mult( model_transform, translation( 0,-2.5, 0) );
    model_transform = mult( model_transform, scale( 1, .5, 2 ) );
    this.m_cube.draw( this.graphicsState, model_transform, red );
    model_transform = mult( model_transform, scale( 1, 2, 1/2 ) )
    model_transform = mult( model_transform, translation( 5,-2, 0) );
}

Animation.prototype.drawPerson = function( model_transform, color, speed )
{
    //body
    model_transform = mult( model_transform, translation( 0, 20, 0) );
    stack.push(model_transform);
    model_transform = mult( model_transform, scale( 1, 3, 1 ) );
    this.m_sphere.draw( this.graphicsState, model_transform, color );
    model_transform = mult( model_transform, scale( 1, 1/3, 1 ) );
    
    //head
    model_transform = mult( model_transform, translation( 0, 3.7, 0) );
    this.m_sphere.draw( this.graphicsState, model_transform, color );
    model_transform = mult( model_transform, translation( 0, -3.7, 0) );
    
    
    
    //sholders
    stack.push(model_transform);
    model_transform = mult( model_transform, translation( 0, 2, 0) );
    model_transform = mult( model_transform, scale( 3.4, .7, .7 ) );
    this.m_cube.draw( this.graphicsState, model_transform, color );
    model_transform = stack.pop();
    
    //arms
    this.drawArm(model_transform, -1, color, speed);
    this.drawArm(model_transform, 1, color, speed);
    
    //hips
    stack.push(model_transform);
    model_transform = mult( model_transform, translation( 0, -2.6, 0) );
    model_transform = mult( model_transform, scale( 3, .8, .8 ) );
    this.m_cube.draw( this.graphicsState, model_transform, color );
    
    model_transform = stack.pop();
    //legs
    this.drawLegs(model_transform, 1, color, speed);
    this.drawLegs(model_transform, -1,color, speed);
}

Animation.prototype.drawLegs = function( model_transform, side, color, speed )
{
    //thighs
    model_transform = mult( model_transform, translation( side*1.05, -2.7, -.2) );
    model_transform = mult(model_transform, rotation(-15*side*Math.sin(this.graphicsState.animation_time/speed)+ 15,1,0,0));
    model_transform = mult( model_transform, translation( 0, -1.3, .3) );
    model_transform = mult( model_transform, scale( .9, 2, .9 ) );
    this.m_cube.draw( this.graphicsState, model_transform, color );
    model_transform = mult( model_transform, scale( 1/.9, 1/2, 1/.9 ) );
    
    //shins
    model_transform = mult( model_transform, translation( 0, -1, -0.4) );
    model_transform = mult(model_transform, rotation(-45*side*Math.sin(this.graphicsState.animation_time/speed)+ 45,1,0,0));
    model_transform = mult( model_transform, translation( 0, -1, .4) );
    model_transform = mult( model_transform, scale( .8, 2, .8 ) );
    this.m_cube.draw( this.graphicsState, model_transform, color );
    
    //feet
    model_transform = mult( model_transform, scale( 1/.8, 1/2, 1/.8 ) );
    model_transform = mult( model_transform, translation( 0, -1,.5 ) );
    model_transform = mult( model_transform, scale( .8, .8, 2 ) );
    this.m_cube.draw( this.graphicsState, model_transform, color );
}

Animation.prototype.drawArm = function( model_transform, side, color, speed )
{
    //biceps
    model_transform = mult( model_transform, translation( side*1.4, 1.5, .3) );
    model_transform = mult(model_transform, rotation(15*side*Math.sin(this.graphicsState.animation_time/speed)- 15,1,0,0));
    model_transform = mult( model_transform, translation( 0, -.75, -.25) );
    model_transform = mult( model_transform, scale( .7, 1.8, .7 ) );
    this.m_cube.draw( this.graphicsState, model_transform, color );
    
    //forearms
    model_transform = mult( model_transform, scale( 1/.7, 1/1.8, 1/.7 ) );
    model_transform = mult( model_transform, translation( 0, -.85, 0.4) );
    model_transform = mult(model_transform, rotation(45*side*Math.sin(this.graphicsState.animation_time/speed)- 45,1,0,0));
    model_transform = mult( model_transform, translation( 0, -.65, -.4) );
    model_transform = mult( model_transform, scale( .7, 1.3, .7 ) );
    this.m_cube.draw( this.graphicsState, model_transform, color );
    
    //hands
    model_transform = mult( model_transform, scale( 1/.7, 1/1.3, 1/.7 ) );
    model_transform = mult( model_transform, translation( 0, -.8,0 ) );
    model_transform = mult( model_transform, scale( .55, .55, .55 ) );
    this.m_sphere.draw( this.graphicsState, model_transform, color );
    
}


Animation.prototype.drawGround = function( model_transform )
{
    model_transform = mult( model_transform, scale( 5000, 1, 5000 ) );
    this.m_cube.draw( this.graphicsState, model_transform, grey );
    model_transform = mult( model_transform, scale( 1/5000, 1, 1/5000 ) );
    model_transform = mult( model_transform, translation( 0, .2, 0) );
    model_transform = mult( model_transform, scale( 100, 1, 180 ) );
    
    this.m_cube.draw( this.graphicsState, model_transform, greenGround );
    
}

Animation.prototype.drawTrack = function( model_transform )
{
    //straight aways
    stack.push(model_transform);
    model_transform = mult( model_transform, translation( -50, .3, 0) );
    model_transform = mult( model_transform, scale( 28, 1, 100 ) );
    this.m_cube.draw(this.graphicsState, model_transform, brown );
    model_transform = mult( model_transform, scale( 1/28, 1, 1/100 ) );
    model_transform = mult( model_transform, translation( 100, 0, 0) );
    model_transform = mult( model_transform, scale( 28, 1, 100 ) );
    this.m_cube.draw(this.graphicsState, model_transform, brown );
    
    //round parts
    model_transform = stack.pop();
    stack.push(model_transform);
    model_transform = mult( model_transform, translation( -50, .3, -50) );
    for(var i = 0; i < 20; i++)
    {
        model_transform = mult( model_transform, scale( 28, 1, 11 ) );
        this.m_cube.draw(this.graphicsState, model_transform, brown );
        model_transform = mult( model_transform, scale( 1/28, 1, 1/11 ) );
        model_transform = mult( model_transform, rotation(-9,0,1,0));
        model_transform = mult( model_transform, translation( 0, 0, -7.9) );
    }
    
    model_transform = stack.pop();
    stack.push(model_transform);
    model_transform = mult( model_transform, translation( -50, .3, 50) );
    for(var i = 0; i < 20; i++)
    {
        model_transform = mult( model_transform, scale( 28, 1, 11 ) );
        this.m_cube.draw(this.graphicsState, model_transform, brown );
        model_transform = mult( model_transform, scale( 1/28, 1, 1/11 ) );
        model_transform = mult( model_transform, rotation(9,0,1,0));
        model_transform = mult( model_transform, translation( 0, 0, 7.9) );
    }
    
    //center design
    model_transform = stack.pop();
    stack.push(model_transform);
    model_transform = mult( model_transform, translation( -5, .4, -18) );
    for(var i = 0; i < 12; i++)
    {
        model_transform = mult( model_transform, rotation(30,0,1,0));
        model_transform = mult( model_transform, translation( -10, 0, 0) );
        model_transform = mult( model_transform, scale( 21, 1, 1 ) );
        this.m_cube.draw(this.graphicsState, model_transform, brown );
        model_transform = mult( model_transform, scale( 1/21, 1, 1 ) );
        //model_transform = mult( model_transform, translation( 10, 0, 0) );
    }
    
    //finish line
    model_transform = stack.pop();
    stack.push(model_transform);
    model_transform = mult( model_transform, translation( -50, .4, 45) );
    model_transform = mult( model_transform, scale( 28, 1, .5 ) );
    this.m_cube.draw(this.graphicsState, model_transform, white );
    model_transform = mult( model_transform, scale( 1/28, 1, 1/.5 ) );
    
    //lines
    model_transform = stack.pop();
    stack.push(model_transform);
    model_transform = mult( model_transform, translation( -36, .4, 0) );
    model_transform = mult( model_transform, scale( .5, 1, 110 ) );
    this.m_cube.draw(this.graphicsState, model_transform, white );
    model_transform = mult( model_transform, scale( 2, 1, 1/110 ) );
    for(var i = 0; i < 7; i++)
    {
        model_transform = mult( model_transform, translation( -4, 0, 0) );
        model_transform = mult( model_transform, scale( .5, 1, 110 ) );
        this.m_cube.draw(this.graphicsState, model_transform, white );
        model_transform = mult( model_transform, scale( 2, 1, 1/110 ) );
    }
    model_transform = mult( model_transform, translation( 96, 0, 0) );
    for(var i = 0; i < 8; i++)
    {
        model_transform = mult( model_transform, translation( 4, 0, 0) );
        model_transform = mult( model_transform, scale( .5, 1, 110 ) );
        this.m_cube.draw(this.graphicsState, model_transform, white );
        model_transform = mult( model_transform, scale( 2, 1, 1/110 ) );
    }
    
    //round lines
    model_transform = stack.pop();
    stack.push(model_transform);
    model_transform = mult( model_transform, translation( -36, .4, -52) );
    var as = 1, zs = 1,sz=1;
    for(var i = 0; i < 8; i++)
    {
        this.drawCurvedLines(model_transform, as, zs, i, sz, 1);
        model_transform = mult( model_transform, translation( -4.3, 0, 0) );
        as=as/(1.02 - .0075*i);
        zs=zs*1.09;
        sz= sz*1.14;
    }
    
    model_transform = stack.pop();
    stack.push(model_transform);
    model_transform = mult( model_transform, translation( -36, .4, 52) );
    var as = 1, zs = 1,sz=1;
    for(var i = 0; i < 8; i++)
    {
        this.drawCurvedLines(model_transform, as, zs, i, sz, -1);
        model_transform = mult( model_transform, translation( -4.3, 0, 0) );
        as=as/(1.02 - .0075*i);
        zs=zs*1.09;
        sz= sz*1.14;
    }
}



Animation.prototype.drawCurvedLines = function( model_transform, as, zs, w, sz, s )
{
    model_transform = mult( model_transform, rotation(-4*s,0,1,0));
    model_transform = mult( model_transform, translation( .5*s, 0, 0) );
    for(var i = 0; i < 21 ; i++)
    {
        model_transform = mult( model_transform, scale( .5, 1, 6.2*sz ) );
        this.m_cube.draw(this.graphicsState, model_transform, white );
        model_transform = mult( model_transform, scale( 2, 1, 1/(6.2*sz) ) );
        model_transform = mult( model_transform, rotation(-8*as*s,0,1,0));
        model_transform = mult( model_transform, translation( 0, 0, -5*zs*s) );
    }
}


Animation.prototype.drawStadium = function( model_transform )
{
    //straight aways
    stack.push(model_transform);
    model_transform = mult( model_transform, translation( -64.5, .1, 0) );
    model_transform = mult( model_transform, scale( 1, 20, 100 ) );
    this.m_cube.draw(this.graphicsState, model_transform, stadiumOutside );
    model_transform = mult( model_transform, scale( 1, 1/20, 1/100 ) );
    model_transform = mult( model_transform, translation( 129, 0, 0) );
    model_transform = mult( model_transform, scale( 1, 20, 100 ) );
    this.m_cube.draw(this.graphicsState, model_transform, stadiumOutside );
    
    
    //round parts
    model_transform = stack.pop();
    stack.push(model_transform);
    model_transform = mult( model_transform, translation( -64.5, .1, -50) );
    for(var i = 0; i < 22; i++)
    {
        model_transform = mult( model_transform, scale( 1, 20, 14 ) );
        this.m_cube.draw(this.graphicsState, model_transform, stadiumOutside );
        model_transform = mult( model_transform, scale( 1, 1/20, 1/14 ) );
        model_transform = mult( model_transform, rotation(-8,0,1,0));
        model_transform = mult( model_transform, translation( 0, 0, -9) );
    }
    
    model_transform = stack.pop();
    stack.push(model_transform);
    model_transform = mult( model_transform, translation( -64.5, .1, 50) );
    for(var i = 0; i < 22; i++)
    {
        model_transform = mult( model_transform, scale( 1, 20, 14 ) );
        this.m_cube.draw(this.graphicsState, model_transform, stadiumOutside );
        model_transform = mult( model_transform, scale( 1, 1/20, 1/14 ) );
        model_transform = mult( model_transform, rotation(8,0,1,0));
        model_transform = mult( model_transform, translation( 0, 0, 9) );
    }
    
    
    //stands
    model_transform = stack.pop();
    stack.push(model_transform);
    model_transform = mult( model_transform, translation( -84, 25, 0) );
    model_transform = mult( model_transform, rotation(-35,0,0,1));
    model_transform = mult( model_transform, scale( 50, 1, 140 ) );
    this.m_cube.draw(this.graphicsState, model_transform, crowd );
    model_transform = mult( model_transform, scale( 1/50, 1, 1/140 ) );
    model_transform = mult( model_transform, translation( 329, 33, 0) );
    model_transform = mult( model_transform, rotation(70,0,0,1));
    model_transform = mult( model_transform, translation( -5, 200, 0) );
    model_transform = mult( model_transform, scale( 50, 1, 140 ) );
    this.m_cube.draw(this.graphicsState, model_transform, crowd );
    
    model_transform = stack.pop();
    stack.push(model_transform);
    model_transform = mult( model_transform, translation( 0, 25, -125) );
    model_transform = mult( model_transform, rotation(35,1,0,0));
    model_transform = mult( model_transform, scale( 120, 1, 50 ) );
    this.m_cube.draw(this.graphicsState, model_transform, crowd );
    model_transform = mult( model_transform, scale( 1/120, 1, 1/50 ) );
    model_transform = mult( model_transform, translation( 0, 83, 330) );
    model_transform = mult( model_transform, rotation(-75,1,0,0));
    model_transform = mult( model_transform, translation( 0, 135, 30) );
    model_transform = mult( model_transform, scale( 120, 1, 50 ) );
    this.m_cube.draw(this.graphicsState, model_transform, crowd);
    
    model_transform = stack.pop();
    stack.push(model_transform);
    this.drawStadiumPillars(model_transform, 1, 1);
    this.drawStadiumPillars(model_transform, -1, 1);
    this.drawStadiumPillars(model_transform, 1, -1);
    this.drawStadiumPillars(model_transform, -1, -1);
    
    //outer walls
    model_transform = stack.pop();
    stack.push(model_transform);
    model_transform = mult( model_transform, translation( -107, 30, 0) );
    model_transform = mult( model_transform, scale( 1, 60, 292 ) );
    this.m_cube.draw(this.graphicsState, model_transform, stadiumOutside );
    model_transform = mult( model_transform, scale( 1, 1/60, 1/292 ) );
    model_transform = mult( model_transform, translation( 214, 0, 0) );
    model_transform = mult( model_transform, scale( 1, 60, 292 ) );
    this.m_cube.draw(this.graphicsState, model_transform, stadiumOutside );
    model_transform = mult( model_transform, scale( 1, 1/60, 1/292 ) );
    
    model_transform = stack.pop();
    model_transform = mult( model_transform, translation( 0, 30, -146) );
    model_transform = mult( model_transform, scale( 214, 60, 1 ) );
    this.m_cube.draw(this.graphicsState, model_transform, stadiumOutside );
    model_transform = mult( model_transform, scale( 1/214, 1/60, 1 ) );
    model_transform = mult( model_transform, translation( 0, 0, 292) );
    model_transform = mult( model_transform, scale( 214, 60, 1 ) );
    this.m_cube.draw(this.graphicsState, model_transform, stadiumOutside );
    model_transform = mult( model_transform, scale( 1/100, 1/60, 1 ) );
    
}

Animation.prototype.drawStadiumPillars = function( model_transform,x,z )
{
    //pillars
    model_transform = mult(model_transform, translation(-75*x, 20, -95*z));
    stack.push(model_transform);
    model_transform = mult( model_transform, rotation(90,1,0,0));
    model_transform = mult( model_transform, scale( 20, 20, 80 ) );
    this.m_cylinder.draw(this.graphicsState, model_transform, grey2 );
    model_transform = mult( model_transform, scale( 1/20, 1/20, 1/80 ) );
    
    
    //fire
    model_transform = stack.pop();
    model_transform = mult( model_transform, rotation(15*this.graphicsState.animation_time/600,0,1,0));
    model_transform = mult(model_transform, translation(0, 40, 0));
    model_transform = mult( model_transform, scale( 20, 17, 20 ) );
    this.m_fire.draw( this.graphicsState, model_transform, fire );
    
    
}



Animation.prototype.update_strings = function( debug_screen_strings )		// Strings this particular class contributes to the UI
{
    debug_screen_strings.string_map["frame"] = "FPS: " + Math.round(1/(this.animation_delta_time/1000), 1) + " fps";
    /*
     debug_screen_strings.string_map["time"] = "Animation Time: " + this.graphicsState.animation_time/1000 + "s";
     debug_screen_strings.string_map["basis"] = "Showing basis: " + this.m_axis.basis_selection;
     debug_screen_strings.string_map["animate"] = "Animation " + (animate ? "on" : "off") ;
     debug_screen_strings.string_map["thrust"] = "Thrust: " + thrust;
     */
}