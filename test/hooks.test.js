var
  should = require('should'),
  hooks = require('../lib/config/hooks');

describe('hooks definition', function () {
  it('should link kuzzle hooks correctly', function () {
    should(hooks).be.an.Object();
    should(hooks['protocol:broadcast']).be.a.String().and.be.eql('broadcast');
    should(hooks['protocol:joinChannel']).be.a.String().and.be.eql('joinChannel');
    should(hooks['protocol:leaveChannel']).be.a.String().and.be.eql('leaveChannel');
  });
});