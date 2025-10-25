/**
 * Middleware to map frontend field names to backend field names
 */
exports.mapEventFields = (req, res, next) => {
    if (req.body.eventname) req.body.name = req.body.eventname;
    if (req.body.eventdate) req.body.date = req.body.eventdate;
    if (req.body.eventdescription) req.body.description = req.body.eventdescription;
    if (req.body.eventlocation) req.body.location = req.body.eventlocation;
    if (req.body.eventcapacity) req.body.maxParticipants = req.body.eventcapacity;
    if (req.body.eventimageurl) req.body.imageUrl = req.body.eventimageurl;
    if (req.body.eventtracks) req.body.tracks = req.body.eventtracks;
    
    next();
  };
  
  exports.mapParticipantFields = (req, res, next) => {
    if (req.body.fullname) req.body.name = req.body.fullname;
    if (req.body.matricnumber) req.body.matricNo = req.body.matricnumber;
    
    next();
  };