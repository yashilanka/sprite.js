
(function(global) {

    var map = null;
    var tilelayers = [];
    var _scene = null;
    var staticCollision = {};
    
    function load(src, callback) {
        var xobj = new XMLHttpRequest();
        xobj.onreadystatechange = function () {
            if (xobj.readyState == 4) {
                var text = xobj.responseText;
                callback(text);
            }
        }
        src = src + "?t=" + (new Date()).getTime();
        xobj.open('GET', src, true);
        xobj.send(null);
    }
        
    function loadMap(src, scene) {
        load(src, function(text) {
            mapCallback(JSON.parse(text));
        });
        _scene = scene;
    }

    function _getGid(x, y) {

        if(x < 0 || y < 0 || x >= map.width || y >= map.height)
            return;
        
        var index = x + y * this.width;
        return this.data[index];
    }

    function mapCallback(_map) {
        map = _map;
        
        for(index in map.layers) {
            var layer = map.layers[index];
            if(layer.type=="tilelayer") {
                layer.getGid = _getGid;
                tilelayers.push(layer);
            }
        }
        buildTileProperties();
        buildStaticCollisions();
        
        var to_load = [];
        for(var i=0; i<map.tilesets.length; i++) {
            to_load.push(map.tilesets[i].image);
        }

        _scene.loadImages(to_load);
       
    }
    
    function paintOn(layer, _x, _y) {
        
        _x = _x / map.tilewidth | 0;
        _y = _y / map.tileheight | 0;
        
        for(var x = 0; x < (layer.w / map.tilewidth); x++) {
            for(var y = 0; y < (layer.h / map.tileheight); y++) {
                for(var i in tilelayers) {
                    var tilelayer = tilelayers[i];
                    var gid = tilelayer.getGid(_x + x, _y + y);
                    if(gid) {
                        var tile = getSprite(gid);
                        // we need to update the position as the Sprites are shared
                        tile.position(map.tilewidth * x, map.tileheight * y);
                        tile.canvasUpdate(layer);
                    }
                }
            }
        }
    }
    
    // just merge all the tile props into a big object
    var tileProp = {}
    function buildTileProperties() {
        for(var i=0; i<map.tilesets.length; i++) {
            var tileset = map.tilesets[i];
            for(index in tileset.tileproperties) {
                var props = tileset.tileproperties[index];
                tileProp[parseInt(index)+tileset.firstgid] = props;
            }
        }
    }
    
    function capitalise(string)
    {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
    
    // merge the collisions from the different layers
    function buildStaticCollisions() {
        for(var i=0; i<tilelayers.length; i++) {
            var tilelayer = tilelayers[i];
            for(index in tilelayer.data) {
                var gid = tilelayer.data[index];
                var prop = getTileProperties(gid);
                var collision = staticCollision[index];
                if(!collision)
                    collision = {};
                
                var pos = ['left', 'top', 'right', 'bottom'];
                
                if(prop.collision) {
                    collision.whole = true;
                }
                
                for(var p in pos) {
                    var propName = 'collision'+capitalise(pos[p]);
                    if(prop[propName])
                        collision[propName] = parseInt(prop[propName]);
                    var propName = 'pass'+capitalise(pos[p]);
                    if(prop[propName])
                        collision[propName] = parseInt(prop[propName]);
                }
                
                staticCollision[index] = collision;
            }
        };
    };
    
    // test collision with real world (x, y)
    function collides(x, y) {
        var _x = x / map.tilewidth;
        var _y = y / map.tileheight;
        if(x < 0 || y < 0 || _x > map.width || _y > map.height)
            return true;
        var index = map.width * (_y | 0) + (_x | 0);

        var collision = staticCollision[String(index)];

        if(!collision)
            return false;
        
        if(collision.passRight) {
            var col = x % map.tilewidth >=  map.tilewidth - collision.passRight;
            if(col)
                return false;
        }
        if(collision.passLeft) {
            var col = x % map.tilewidth <=  collision.passLeft;
            if(col)
                return false;
        }
        if(collision.passTop) {
            var col = y % map.tileheight <= collision.passTop;
            if(col)
                return false;
        }
        if(collision.passBottom) {
            var col = y % map.tileheight >= map.tileheight - collision.passBottom;
            if(col)
                return false;
        }
        
        if(collision.whole) {
            return true;
        }
        
        if(collision.collisionRight) {
            var col = x % map.tilewidth >=  map.tilewidth - collision.collisionRight;
            if(col)
                return true;
        }
        if(collision.collisionLeft) {
            var col = x % map.tilewidth <=  collision.collisionLeft;
            if(col)
                return true;
        }
        if(collision.collisionTop) {
            var col = y % map.tileheight <= collision.collisionTop;
            if(col)
                return true;
        }
        if(collision.collisionBottom) {
            var col = y % map.tileheight >= map.tileheight - collision.collisionBottom;
            if(col)
                return true;
        }
        
        return false;
    }
    
    function getTileProperties(gid) {
        if(tileProp[gid]) {
            return tileProp[gid];
        }
        return {};
    }
    
    function findTileset(gid) {
        // find the tileset for the gid
        var tileset = null;
        for(var i=0; i<map.tilesets.length; i++) {
            tileset = map.tilesets[i];
            if(gid < tileset.firstgid) {
                tileset = map.tilesets[i-1];
                break;
            }
        }
        return tileset;
    }

    function getSprite(gid) {
        // return the sprite according to the gid
        var tileset = findTileset(gid);
        var localGid = gid - (tileset.firstgid);
        var tw = tileset.tilewidth;
        var th = tileset.tileheight;

        var nb_x = tileset.imagewidth / tw | 0;
        var nb_y = tileset.imageheight / th | 0;
        
        var x = localGid % nb_x;
        var y = localGid / nb_x | 0;

        var sp = _scene.Sprite(tileset.image, {w:tw, h:th, xoffset:x * tw, yoffset:y * th, layer:null});
        return sp;
    }
    
    // TODO: naming
    global.sjs.map = {
        loadMap:loadMap, 
        findTileset:findTileset,
        getSprite:getSprite,
        tilelayers:tilelayers,
        map:map,
        paintOn:paintOn,
        buildStaticCollisions:buildStaticCollisions,
        staticCollision:staticCollision,
        getTileProperties:getTileProperties,
        collides:collides
    };

})(this);