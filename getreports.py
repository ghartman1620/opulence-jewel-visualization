# Get many reports from the WCL api and store them in a file called reports.txt
# These can then be queried for their opulence fight and events.

from requests import get


with open('key', 'r') as f:
    key = f.read()
print(key)


total_reports = set()
OPULENCE_ID = 2271

# first page
resp = get("https://www.warcraftlogs.com:443/v1/rankings/encounter/" + str(OPULENCE_ID), 
            params={'api_key' : key})
obj = resp.json()

while obj['hasMorePages'] and obj['page'] < 2:
    # get the reports on this page
    for rank in obj['rankings']:
        # I don't know why reportID would be none, and I 
        # certainly don't know why the same page ranking request
        # doesn't consistently return None. Oh well...
        if 'reportID' in rank and rank['reportID'] is not None \
            and not rank['reportID'] in total_reports:
                total_reports.add(rank['reportID'])

    
    resp = get('https://www.warcraftlogs.com:443/v1/rankings/encounter/' + str(OPULENCE_ID), 
            params={'api_key' : key, 'page' : obj['page'] + 1})
    obj = resp.json()

with open('reports2=.txt', 'w') as f:
    f.write("\n".join(total_reports))