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

var texture_filenames_to_load = [ "stars.png", "text.png", "earth.gif" ];

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
		self.m_cylinder = new cylindrical_strip( 10, mat4() );
		
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
	shortcut.add( "Space", function() { thrust[1] = -1; } );			shortcut.add( "Space", function() { thrust[1] =  0; }, {'type':'keyup'} );
	shortcut.add( "z",     function() { thrust[1] =  1; } );			shortcut.add( "z",     function() { thrust[1] =  0; }, {'type':'keyup'} );
	shortcut.add( "w",     function() { thrust[2] =  1; } );			shortcut.add( "w",     function() { thrust[2] =  0; }, {'type':'keyup'} );
	shortcut.add( "a",     function() { thrust[0] =  1; } );			shortcut.add( "a",     function() { thrust[0] =  0; }, {'type':'keyup'} );
	shortcut.add( "s",     function() { thrust[2] = -1; } );			shortcut.add( "s",     function() { thrust[2] =  0; }, {'type':'keyup'} );
	shortcut.add( "d",     function() { thrust[0] = -1; } );			shortcut.add( "d",     function() { thrust[0] =  0; }, {'type':'keyup'} );
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
var purple = new Material( vec4( .3,.1,.9,1 ), .8, .5, .8, 20 ),
yellow = new Material( vec4( .6,.6,.1,1 ), .8, 1, .8, 20 ),
grey = new Material( vec4( .5,.5,.5,1 ), .3, .1, .2, 40 ),
red = new Material( vec4(1, .1, .1, 1), .8, 1, .5, 40),
brown = new Material( vec4(.9, .5, .5, 1), .4, 1, .5, 40),
greenGround = new Material( vec4( .1,.9,.1,1 ), .8, 1, .5, 40 ),
wingAngle = 60,
stack = [];

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
        
        model_transform = mult( model_transform, translation( 0, -10, 0) );
        this.drawGround(model_transform);
        this.drawFlower(model_transform);
        
        model_transform = mult(model_transform, rotation(this.graphicsState.animation_time / 40, 0, 1, 0));
        model_transform = mult(model_transform, translation(0, 10, -10));
        model_transform = mult(model_transform, translation(0,Math.sin(this.graphicsState.animation_time/500)*2,0));
        
        this.drawBee(model_transform);
	}	

Animation.prototype.drawGround = function( model_transform )
{
    model_transform = mult( model_transform, scale( 500, 1, 500 ) );
    this.m_cube.draw( this.graphicsState, model_transform, greenGround );
}

Animation.prototype.drawFlower = function( model_transform )
{
    
    for(var i = 0; i < 8; i++)
    {
        model_transform = mult(model_transform, rotation(3*Math.sin(this.graphicsState.animation_time/800), 0,0,1));
        model_transform = mult(model_transform, translation(0, 1, 0));
        this.drawStem(model_transform);
        model_transform = mult(model_transform, translation(0, .5, 0));
    }
    
    model_transform = mult(model_transform, scale( 2, 2, 2));
    model_transform = mult( model_transform, rotation(Math.sin(this.graphicsState.animation_time/20), 1, 1, 0));
    model_transform = mult(model_transform, translation( 0, 1, 0));
    this.m_sphere.draw( this.graphicsState, model_transform, red);
}

Animation.prototype.drawStem = function( model_transform )
{
    model_transform = mult(model_transform, scale( .5,1.5,.5));
    this.m_cube.draw( this.graphicsState, model_transform, brown);
}

Animation.prototype.drawBee = function( model_transform )
{
    stack.push(model_transform);
    //Body
    model_transform = mult( model_transform, scale( 2, 1, 1 ) );
    this.m_cube.draw( this.graphicsState, model_transform, grey );
    
    //Head
    model_transform = mult( model_transform, scale( .25, .5, .5 ) );
    model_transform = mult( model_transform, translation(-3,0,0));
    this.m_sphere.draw( this.graphicsState, model_transform, purple);
    
    //Thorax
    model_transform = mult( model_transform, translation(9,0,0));
    model_transform = mult( model_transform, scale( 4, 2, 2 ) );
    this.m_sphere.draw( this.graphicsState, model_transform, yellow);

    //Return to Original Position
    model_transform = stack.pop();
    stack.push(model_transform);
    
    //Wings
    model_transform = mult( model_transform, translation(0,.5,-.25));
    this.drawWing(model_transform, 40);
    model_transform = mult( model_transform, translation(0,0,.5));
    this.drawWing(model_transform, -40);
    
    //Return to Original Position
    model_transform = stack.pop();
    
    model_transform = mult(model_transform, translation(0, -.8, .5));
    for(var i = -.5; i < 1; i+=.5)
        this.drawLeg(model_transform, i, 1);

    model_transform = mult(model_transform, translation(0, 0, -1));

    for(var i = -.5; i < 1; i+=.5)
        this.drawLeg(model_transform, i, -1);
}

Animation.prototype.drawLeg = function( model_transform , numLeg, side)
{
    model_transform = mult(model_transform, rotation(side*10*Math.cos(this.graphicsState.animation_time/500)+side*10,1,0,0));
    model_transform = mult(model_transform, translation(numLeg*1.5, 0, 0));
    model_transform = mult( model_transform, scale( .25, .6, .25 ) );
    this.m_cube.draw( this.graphicsState, model_transform, grey);
    model_transform = mult (model_transform, scale(1/.25,1/.6, 1/.25));
    
    model_transform = mult(model_transform, translation(0, -.3, side*-.25));
    model_transform = mult(model_transform, rotation(side*12*Math.cos(this.graphicsState.animation_time/500)+side*12,1,0,0));
    model_transform = mult(model_transform, translation(0, -.25, side*.25));
    model_transform = mult( model_transform, scale( .25, .6, .25 ) );
    this.m_cube.draw( this.graphicsState, model_transform, grey);
}

Animation.prototype.drawWing = function( model_transform, w )
{
    model_transform = mult(model_transform, translation(0, 0, 1/(1.4*Math.sign(w))));
    model_transform = mult(model_transform, rotation(w*Math.cos(this.graphicsState.animation_time/500), 1, 0, 0));
    model_transform = mult(model_transform, translation(0, .015, 1.55*Math.sign(w)));
    model_transform = mult( model_transform, scale( 1, .1, 3 ) );
    this.m_cube.draw( this.graphicsState, model_transform, grey);
}


Animation.prototype.update_strings = function( debug_screen_strings )		// Strings this particular class contributes to the UI
{
	debug_screen_strings.string_map["time"] = "Animation Time: " + this.graphicsState.animation_time/1000 + "s";
	debug_screen_strings.string_map["basis"] = "Showing basis: " + this.m_axis.basis_selection;
	debug_screen_strings.string_map["animate"] = "Animation " + (animate ? "on" : "off") ;
	debug_screen_strings.string_map["thrust"] = "Thrust: " + thrust;
}