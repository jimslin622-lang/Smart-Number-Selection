from PIL import Image, ImageDraw

def create_icon(filename, color, draw_func, size=81):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw_func(draw, size, color)
    img.save(filename)

def draw_home(draw, size, color):
    s = size
    # house body
    draw.rectangle([s*0.25, s*0.45, s*0.75, s*0.78], fill=color, outline=color)
    # roof
    draw.polygon([(s*0.15, s*0.45), (s*0.5, s*0.18), (s*0.85, s*0.45)], fill=color, outline=color)
    # door
    draw.rectangle([s*0.42, s*0.58, s*0.58, s*0.78], fill=(255,255,255,255))

def draw_record(draw, size, color):
    s = size
    cx, cy = s//2, s//2
    r = int(s*0.28)
    draw.ellipse([cx-r, cy-r, cx+r, cy+r], outline=color, width=int(s*0.06))
    # clock hands
    draw.line([(cx, cy), (cx, cy-int(r*0.6))], fill=color, width=int(s*0.06))
    draw.line([(cx, cy), (cx+int(r*0.5), cy)], fill=color, width=int(s*0.06))

def draw_profile(draw, size, color):
    s = size
    cx = s//2
    # head
    r = int(s*0.18)
    draw.ellipse([cx-r, int(s*0.22), cx+r, int(s*0.22)+r*2], fill=color, outline=color)
    # body
    draw.arc([int(s*0.18), int(s*0.52), int(s*0.82), int(s*0.95)], start=0, end=180, fill=color, width=int(s*0.07))

# Generate icons
create_icon('home.png', '#9ca3af', draw_home)
create_icon('home-active.png', '#22c55e', draw_home)
create_icon('record.png', '#9ca3af', draw_record)
create_icon('record-active.png', '#22c55e', draw_record)
create_icon('profile.png', '#9ca3af', draw_profile)
create_icon('profile-active.png', '#22c55e', draw_profile)

print("Icons generated successfully")
