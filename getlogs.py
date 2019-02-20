from requests import get
from requests.exceptions import RequestException
import csv
from pprint import pprint
from json.decoder import JSONDecodeError
from json import dumps, loads
from time import sleep, time # for request failure backoff

with open("key", "r") as f:
    key = f.read()
print(key)

# workflow:
# get rankings. look through each report considered
# for each report, get the fight id that was ranked.
# get /report/fights to find the start and end time of the fight ranked
# for each player in the group, get their dps, and examine the events to determine which jewel they took.
# will be an applydebuff event. 
# record for that player's spec the dps they dealt in the fight by looking at the /report/tables/ along with their jewel
# continue for each report.
# this gonna be SLOW AF. 
# look into the filter param to events to try to make fewer requests, ideally can
# filter for only debuffgained events to maybe reduce the number of requests required per fight to find
# each player's jewel.

# fantastic, that can be done. now only need two requests:
# one for events containing combatant ids and which jewels each combatant picked up
# another for dps tables

# filter for events to get a jewel picked up debuff 
# i suppose the applydebuff type filter is not necessary, since the only abilities with these names
# would be an applied debuff. But it doesn't hurt and won't make the filter any slower.
'''
type = "applydebuff" and 
(ability.name = "Diamond of the Unshakeable Protector" or 
ability.name = "Amethyst of the Shadow King" or 
ability.name = "Tailwind Sapphire" or
ability.name = "Ruby of Focused Animus" or
ability.name = "Opal of Unleashed Rage" or
ability.name = "Topaz of Brilliant Sunlight" or
ability.name = "Emerald of Earthen Roots")
'''

# check out /report/tables/damage-done/report-id, and for each thing in entries:
# get the total damage done
# divide by the delta between end time and start time of the fight
# that's their dps, and we can store it and do whatever we like with it.

# as far as data storage, just need a large list of triples: spec/dps/jewel. then can say things like
# what percentile among that spec is each parse, etc. then can do stuff like see the average parse percentile
# of each jewel and stuff like that.


OPULENCE_ID = 2271
# for now just normal
DIFFICULTY = 3


TOPAZ_STR = "Topaz of Brilliant Sunlight"
RUBY_STR = "Ruby of Focused Animus"
EMERALD_STR = "Emerald of Earthen Roots"
OPAL_STR = "Opal of Unleashed Rage"


def dps_by_jewel_from_fight(fight, report):

    save_dir = "cache/"
    filestr = str(report) + "_" + str(fight["id"])
    dmg_file_ext = "_damage.json"
    events_file_ext = "_debuffevents.json"
    obj = {}
    try:
        f = open(save_dir + filestr + dmg_file_ext, "r")
        obj = loads(f.read())
        print("Got report " + str(report) + " damage from file")
        f.close()
    except IOError:
        print("Could not get report " + str(report) + " damage from file. Requesting")
        resp = get("https://www.warcraftlogs.com:443/v1/report/tables/damage-done/" + report, 
                params={"api_key" : key, "translate" : True, "start" : fight["start_time"], "end" : fight["end_time"]})
        # resp contains entries, each of which contains a player with their total dps and
        # their dps breakdown by ability. Also contains each player's name and id.
        # see https://www.warcraftlogs.com/v1/docs#!/Report/report_tables_view_code_get
        obj = resp.json()
        f = open(save_dir + filestr + dmg_file_ext, "w")
        f.write(dumps(obj))
        f.close()

    # 1000 to get from millis to whole seconds
    time_in_seconds = (int(fight["end_time"]) - int(fight["start_time"]))/1000
    players = {}


    for player in obj["entries"]:
        players[player["id"]] = {"dps_sum" : float(player["total"])/time_in_seconds,
                "spec" : player["icon"]}
        for target in player["targets"]:
            players[player["id"]][target["name"]] = target["total"]/time_in_seconds
    # now, let us get all the jewels that each player took.
    # it's a bummer we cant do this using the debuff table
    # becuase it doesn't show which people have which jewel.
    # that would be good to workaround the translation + filter issue
    
    # because the filter is applied before the translation, so even
    # if we translate it it still looks for ability name by the
    # pre-translated version 
    events_obj = {}
    try:
        f = open(save_dir + filestr + events_file_ext)
        events_obj = loads(f.read())
        print("Got report " + str(report) + " events from file")
        f.close()
    except IOError:
        print("Could not get report " + str(report) + " events from file. Requesting")
        resp = get("https://www.warcraftlogs.com:443/v1/report/events/" + report, 
                params={"api_key" : key, "translate" : True, "start" : fight["start_time"], "end" : fight["end_time"], 
                "filter" : 
    '''
    type = "applydebuff" and 
    (ability.name = "Diamond of the Unshakeable Protector" or 
    ability.name = "Amethyst of the Shadow King" or 
    ability.name = "Tailwind Sapphire" or
    ability.name = "Ruby of Focused Animus" or
    ability.name = "Opal of Unleashed Rage" or
    ability.name = "Topaz of Brilliant Sunlight" or
    ability.name = "Emerald of Earthen Roots")
    '''
        })
        events_obj = resp.json()
        f = open(save_dir + filestr + events_file_ext, "w")
        f.write(dumps(events_obj))
        f.close()
    if len(events_obj["events"]) == 0:
        return
    for event in events_obj["events"]:
        # if some great fool didn't fucking hit the boss, then we won't bother counting them. Two reasons:
        # one, harder to find their spec, will need to look them up in another table, requiring another request
        # two, they're usually a healer, and i'm slightly less concerned with healer dps by jewel, 
        # and i'm certainly not concerned in counting towards the average healers who don't hit the boss at all,
        # since they'll do 0 dps regardless of which jewel they picked.
        try:
            players[event["targetID"]]["jewel"] = event["ability"]["name"]
        except KeyError:
            # if we were to look them up in another table to determine their spec
            # to count them in the average, we'd do so here.
            pass


    # dps_rankings looks like this:
    # { Warrior-Arms: { Ruby: total dps, count of arms warriors who picked ruby, dps to each target
    #                   Topaz: "",
    #                    etc for other jewels}
    # etc for other specs}
    for player in players.values():
        # don't consider fools who died before they were able to pick up a gem.
        # thanks for the bug testing, silent watch fools who died before they got a gem!
        if "jewel" in player:
            if not player["spec"] in dps_rankings:
                dps_rankings[player["spec"]] = {}
            if not player["jewel"] in dps_rankings[player["spec"]]:
                dps_rankings[player["spec"]][player["jewel"]] = {"count" : 0}
            # all the stuff about this player we want to add
            for item in player:
                # not adding their jewel or spec, just their dps
                if item is not "jewel" and item is not "spec":
                    if item in dps_rankings[player["spec"]][player["jewel"]]:
                        dps_rankings[player["spec"]][player["jewel"]][item] += player[item]
                    else:
                        dps_rankings[player["spec"]][player["jewel"]][item] = player[item]
            dps_rankings[player["spec"]][player["jewel"]]["count"] += 1


    # 2. Find the group's average dps and how many of the support dps jewels they had.

    # keep track for this parse of how many of each of the support jewels was taken
    ruby_count = 0
    topaz_count = 0
    group_dps_sum = 0
    dps_count = 0
    for player in players.values():
        if "jewel" in player:
            if player["jewel"] == RUBY_STR or player["jewel"] == TOPAZ_STR or player["jewel"] == EMERALD_STR or player["jewel"] == OPAL_STR:
                dps_count += 1
                group_dps_sum += player["dps_sum"]
            if player["jewel"] == RUBY_STR:
                ruby_count += 1
            elif player["jewel"] == TOPAZ_STR:
                topaz_count += 1
    
    group_dps_avg = group_dps_sum/dps_count

    print(dps_count)
    # if no group this size yet, set up the structure
    if len(players) not in size_jewel_group_dps:
        size_jewel_group_dps[len(players)] = {RUBY_STR : {}, TOPAZ_STR : {}}
    # if no group this size has taken this quantity of rubies, set up a count for this quantity of rubies
    if ruby_count not in size_jewel_group_dps[len(players)][RUBY_STR]:
        size_jewel_group_dps[len(players)][RUBY_STR][ruby_count] = {"count" : 0, "avg_dps_sum" : 0}
    # same with topaz
    if topaz_count not in size_jewel_group_dps[len(players)][TOPAZ_STR]:
        size_jewel_group_dps[len(players)][TOPAZ_STR][topaz_count] = {"count" : 0, "avg_dps_sum" : 0}
    
    size_jewel_group_dps[len(players)][RUBY_STR][ruby_count]["count"] += 1
    size_jewel_group_dps[len(players)][RUBY_STR][ruby_count]["avg_dps_sum"] += group_dps_avg
    size_jewel_group_dps[len(players)][TOPAZ_STR][topaz_count]["count"] += 1
    size_jewel_group_dps[len(players)][TOPAZ_STR][topaz_count]["avg_dps_sum"] += group_dps_avg


def dps_by_jewel_from_report(report):
    save_dir = "cache/"
    filestr = str(report)
    fights_file_ext = "_fights.json"
    fights_obj = {}
    try:
        f = open(save_dir + filestr + fights_file_ext, "r")
        fights_obj = loads(f.read())
        print("Got report " + str(report) + " fights from file")
        f.close()
    except IOError:
        print("Could not get report " + str(report) + " fights from file. Requesting")
        # find the opulence fight(s) from our report
        # fights contains a list of all the fights, their start and end time, and
        # what was being fought. see https://www.warcraftlogs.com/v1/docs#!/Report/report_fights_code_get
        resp = get("https://www.warcraftlogs.com:443/v1/report/fights/" + report, 
                params={"api_key" : key, 'translate' : True})
        
        if(resp.status_code == 429):
            print("Too many requests - raising RequestException")
            raise RequestException("Too many requests")
        # other errors
        elif(resp.status_code != 200):
            raise Exception("Other non-success response received: " + str(resp.status_code))
        fights_obj = resp.json()
        f = open(save_dir + filestr + fights_file_ext, "w")
        f.write(dumps(fights_obj))
    opulence_kills = []
    for fight in fights_obj["fights"]:
        if fight["boss"] == OPULENCE_ID and fight["kill"] and fight["difficulty"] == 3:
            opulence_kills.append(fight)
    
    # get dps for each player
    for fight in opulence_kills:
        dps_by_jewel_from_fight(fight, report)




# dps_rankings has the following:
# For each spec, for each jewel taken by that spec, the sum of the dps we've seen so far, and the number of people
# who have taken that jewel. Whenever we're done, however long that takes, then go and compute the average?
# alternately, maybe we want to remember each dps so we can talk about the median and various percentile parses
# and ask questions like what the average percentile parse is of people who take various jewels?
# for now lets just do average dps by jewel. But that might be interesting.

dps_rankings = {}

# want, for groups of each size, 10-30
# for each of red and yellow jewels:
# average dps in groups for each number of red and yellow jewels.
# so we'll have a structure that looks like:
'''
{
  looking at parses with 10 players:
  10: {
    dps by ruby count:
    ruby: {
      groups that had 10 ruby
      0: {
        how many groups had 0 ruby
        count: 
        how much dps per player did they deal
        dps:
      }
      etc for other count of rubies
      1: {...}
    }
    etc for other count of topaz
    topaz: {...}
  }
  11: {...}
}
'''
size_jewel_group_dps = {}

# finally i'd also like to see combinations of ruby & topaz - how do groups do with exactly
# 2 ruby, & 1 topaz for example.
# By group size of course.
# structure is:
# {
# 10 (group size): [
#   {
#       ruby: #,
#       topaz: #,
#       count: #,
#       dps: #
#   },
#   {
#   }
# ],
dps_by_jewel_combination = {}

reports = []

# get report ids from file, from getreports.py
with open("reports.txt", "r") as f:
    line = f.readline()
    while line != "":
        reports.append(line.strip())
        line = f.readline()

print(str(len(reports)))


i = 0
retry_backoff = .5
while i < len(reports):
    report = reports[i]
    # Disregard the below! I found it out!
    # I got errors for two reasons:
    # 1. Not translating fight listing requests
    # 2. There's a rate limit, and I found it! 120 requests/2 min. 
    # So let us allow no maximum timeout for errors from rate limit.
    # We'll keep waiting as long as the API asks.
    # from https://stackoverflow.com/questions/5998245/get-current-time-in-milliseconds-in-python
    # millis = int(round(time() * 1000))
    try:
        dps_by_jewel_from_report(report)
        retry_backoff = .5
    # we can still keep the exponential backoff, incase there's some other issue (doesn't hurt) or 
    # we hit the rate limit anyway.
    except RequestException as e:
        # same as below, except if it was a rate limit there's no
        # maximum number of retries, just keep raising the exponential backoff
        # wait.
        print("RequestException caught, waiting on report " + str(report) + " for " + str(retry_backoff))
        sleep(retry_backoff)
        retry_backoff *= 2
        i -= 1
    except Exception as e:
        # max 5 retries: .5, 1, 2, 4, 8
        if retry_backoff < .5:
            print("There was an error in analyzing " + str(report) + ". Trying again in " + str(retry_backoff) + " seconds:")
            print(str(e))
            sleep(retry_backoff)
            retry_backoff *= 2
            i -= 1
        else:
            print("There were repeated errors in analyzing " + str(report) + ". Skipping it.")
            retry_backoff = .5
    # print("report " + str(i))
    if (i%20 == 0):
        print("ranking " + str(i/20))
        # ATM don't write these reports I've already got them.
        # with open("rankingsbytarget_progress.json", "w") as f:
        #     f.write(dumps(dps_rankings))
        with open("groupsizedps_perdps_progress2.json", "w") as f:
            f.write(dumps(size_jewel_group_dps))

    # instead of this, just allow no maximum to our backoff for rate limit errors.
    # wait for the request to take 1 second so we dont hit the rate limit
    # millis2 = int(round(time() * 1000))
    # if millis2 - millis < 1050:1
    #     sleep(1.05-(millis2-millis)/1000)
    i+=1
pprint(dps_rankings)
pprint(size_jewel_group_dps)
# ATM don't write these reports I've already got them.
# with open("rankingsbytarget6.json", "w") as f:
#     f.write(dumps(dps_rankings))
with open("groupsizedps_perdps2.json", "w") as f:
    f.write(dumps(size_jewel_group_dps))