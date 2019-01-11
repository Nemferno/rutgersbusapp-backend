
/**
 * @constructor
 */
function Reminder(
    reminderid, userid, startDate, reminderDuration, localEstimate,
    reminderExpected, pending, blocked, target, stopid, routeid, universityid,
    isComplete
) {
    this.reminderid = reminderid;
    this.userid = userid;
    this.startDate = startDate;
    this.reminderDuration = reminderDuration;
    this.localEstimate = localEstimate;
    this.reminderExpected = reminderExpected;
    this.pending = pending;
    this.evblocked = blocked;
    this.target = target;
    this.stopid = stopid;
    this.routeid = routeid;
    this.universityid = universityid;
    this.iscomplete = isComplete;
}

module.exports = { Reminder };
