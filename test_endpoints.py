import urllib.request
import urllib.error

urls = {
    "Public": "http://localhost:3000/",
    "Auth": "http://localhost:3000/auth",
    "Admin": "http://localhost:3000/admin"
}

for name, url in urls.items():
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            print(f"{name}: {response.getcode()}")
    except urllib.error.HTTPError as e:
        print(f"{name}: {e.code}")
    except urllib.error.URLError as e:
        print(f"{name}: Failed to connect ({e.reason})")
