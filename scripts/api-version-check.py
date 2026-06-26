import sys, json
d = json.load(sys.stdin)['data']
print('version=' + d['version'] + ' buildDate=' + d['buildDate'] + ' highlights=' + str(len(d['highlights'])))
