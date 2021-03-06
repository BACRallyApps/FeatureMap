var Ext = window.Ext4 || window.Ext;

var app = null;

// Remeber to change the reference in generated file to the following so that the older sdk is used.
//     <script type="text/javascript" src="//rally1.rallydev.com/apps/2.0rc3/sdk.js?wsapiVersion=1.43"></script>

Ext.define('Rally.print.FeatureMap', {
  requires: ['Ext.XTemplate'],
  extend: 'Rally.ui.plugin.print.Print',
  alias: 'plugin.featuremapprinting',

  init: function(component){
    //console.log('Initializing Printing');
    this.callParent(arguments);
    this.component = component;
  },

  _getHtmlContent: function(dom) {
    var el = Ext.DomHelper.createDom({});
    var main = Ext.clone(dom.dom);
    Ext.fly(main).setHeight('100%');
    Ext.Array.each(Ext.query('div.x-box-inner', main), function (box) {
      Ext.fly(box).setWidth(parseInt(box.style.width, 10) + 10);
      Ext.fly(box).setLeft(parseInt(box.style.left, 10) + 15);
      //console.log(box.style.width, typeof box.style.width, parseInt(box.style.width, 10));
    });

    Ext.Array.each(Ext.query('//link[rel="stylesheet"]', dom), function (link) {
      //console.log("Adding link", link);
      el.appendChild(link);
    });
    // console.log("#appCss",Ext.query("#appCss")[0]);
    el.appendChild(Ext.clone(Ext.query("#appCss")[0]));
    el.appendChild(main);
    // console.log('Printing', el);
    return el.innerHTML;
  },

  getContent: function() {
    return this._getHtmlContent(this.component.getEl());
  },

  getHeader: function() {
    return '';
  }
});

Ext.define('CustomApp', {
    extend: 'Rally.app.TimeboxScopedApp',
    // extend: 'Rally.app.App',
    mixins: {
        observable: 'Ext.util.Observable',
        maskable: 'Rally.ui.mask.Maskable'
    },

    plugins: [{
      ptype: 'featuremapprinting',
      pluginId: 'print'
    }],

    scopeType: 'release',
    componentCls: 'app',
    settingsScope: 'workspace',
    autoScroll: true,

    scheduleStates: ['Backlog', 'Defined', 'In-Progress', 'Completed', 'Accepted', 'Released'],

    config: {
      defaultSettings: {
        storyCardsPerColumn: 5,
        'state-color-backlog': '#E5E5E5',
        'state-color-defined': '#E5E5E5',
        'state-color-in-progress': '#FDEFA7',
        'state-color-completed': '#FDEFA7',
        'state-color-accepted': '#BFF0B8',
        'state-color-released': '#B0C9FF'
      }
    },

    stories: null,
    features: null,
    initiatives: null,

    layout: {
      type: 'vbox'
    },

    // launch: function() {
    //   var me = this;
    //   console.log("launch");
    //   console.log('Scope',me.getContext().getTimeboxScope());
    //   var timebox = me.getContext().getTimeboxScope();

    //   if (_.isUndefined(timebox)) {

    //     me.add( Ext.create("Rally.ui.combobox.ReleaseComboBox",{
    //       listeners : {
    //         select : function(a,release,c) {
    //           console.log(this.getQueryFilter());

    //           // me.getContext().setTimeboxScope(release);
    //           // me.onScopeChange(me.getContext().getTimeboxScope());
    //         }
    //       }
    //     }));

    //   } else {
    //     me.onScopeChange(timebox.getRecord());
    //   }

    //   // if 
    // },


    constructor: function (config) {
      console.log("constructor");
      var me = this;
      
      if (_.keys(me.getSettings()).length > 0)
        me.settings = me.getSettings() 
      else
        me.settings = me.config.defaultSettings;

      // console.log("settings",me.settings);

      this.callParent([config]);
      this.mixins.observable.constructor.call(this, config);
      //this.mixins.maskable.constructor.call(this, {maskMsg: 'Loading...'});

      this.addEvents('load', 'scheduleStatesLoaded');

      this.on('afterrender', function (t) {
        var mainDiv = t.getEl().first();
        //console.log('app loaded', mainDiv.getWidth(false), mainDiv.getHeight(false));

        var cDiv = Ext.DomHelper.append(mainDiv, {
          tag: 'div',
          cls: 'canvas',
          id: 'canvas'
        });

        me.canvas = Raphael(cDiv);
        me.viewportDiv = mainDiv;
        me.canvasDiv = cDiv;
      });

      this.on('afterlayout', function(t) {
        var mainDiv = t.getEl().first();
        me.canvas.setSize(mainDiv.getWidth(false), mainDiv.getHeight(false));
      });

      this.fidTemplate = Rally.nav.DetailLink;
      this.cardTemplate = new Ext.XTemplate(
        '<tpl if="color != null">',
          '<div class="card {type} state-{state} oid-{oid}" style=\'border-top: solid 8px {color}\'>',
        '<tpl else>',
          '<div class="card {type} state-{state} oid-{oid} {blocked} {pred_succ}">',
        '</tpl>',
            '<p class="name">{fidLink} {name}</p>',
            '<tpl if="size"><p class="size">{size}</p></tpl>',
            '<div class="iteration-status iteration-status-{iterationStatus}"></div>',
            '<tpl if="pred_succ">',
              '<div class="link_indicator"></div>',
            '</tpl>',
          '</div>'
      );
      this.headerTemplate = new Ext.XTemplate(
        '<div class="header" style="width: {width}">',
          '<div class="name"><h1>{name} - FEATURE BACKLOG</h1></div>',
          '<div class="info">',
            '{accepted} of {total} Story Points are done. ',
            '{[ values.completed - values.accepted ]} Story Points are awaiting approval. ',
            '{[ values.total - values.accepted ]} Story Points remaining. ',
            '<tpl if="notEstimated"><span style="color: red">{notEstimated} Stories are not estimated.</span></tpl>',
          '</div>',
        '</div>'
      );
    },

    getSettingsFields: function () {
      var fields = [{
        name: 'storyCardsPerColumn',
        label: 'Story Cards per Column',
        xtype: 'rallynumberfield'
      }];

      Ext.Array.each(this.scheduleStates, function (state) {
        fields.push({
          name: 'state-color-' + state.toLowerCase(),
          label: state + ' Color',
          xtype: 'rallytextfield'
        });
      });

      return fields;
    },

    getOptions: function () {
      return [{
        text: 'Print',
        handler: this.openPrintPage,
        scope: this
      }, {
        text: 'Show Color Legend',
        handler: this.showLegend,
        scope: this
      }];
    },

    _buildLegendEntry: function (label, color) {
      return {
        xtype: 'container',
        layout: {
          type: 'hbox'
        },
        style: {
          margin: '5px'
        },
        items: [{
          xtype: 'box',
          width: 16,
          height: 16,
          style: {
            border: color ? 'solid 1px black' : '',
            backgroundColor: color,
            marginRight: '5px'
          },
          html: '&nbsp'
        }, {
          xtype: 'box',
          height: 16,
          style: {
            verticalAlign: 'middle',
            display: 'table-cell',
            paddingTop: '2px'
          },
          html: ' ' + label
        }]
      };
    },

    showLegend: function () {
      var dlgWidth = 200;
      var me = this;

      if (!this.legendDlg) {
        var legend = [];

        
        _.each(me.scheduleStates, function (state) {
          legend.push(me._buildLegendEntry(state, me.settings[('state-color-' + state.toLowerCase())] || 'white'));
        }, this);

        legend.push(me._buildLegendEntry('', ''));

        _.forOwn({ 'Not Scheduled': 'grey', 'Scheduled in Future Iteration': 'yellow', 'Scheduled in Current Iteration': 'green', 'Not Accepted in Past Iteration': 'red' }, function (color, label) {
          legend.push(me._buildLegendEntry(label, color));
        });

        this.legendDlg = Ext.create('Rally.ui.dialog.Dialog', {
          autoShow: true,
          draggable: true,
          width: dlgWidth,
          height: (4  + me.scheduleStates.length) * 27,
          title: 'Story Color Legend',
          closable: true,
          closeAction: 'hide',
          modal: false,
          x: Ext.fly(this.getEl()).getWidth() - dlgWidth - 50,
          y: 20,
          items: legend
        });
      } else {
        this.legendDlg.show();
      }
    },

    addToContainer: function (con) {
      if (_.isUndefined(this.panel) || _.isNull(this.panel)) {
        this.panel = Ext.create('Ext.panel.Panel');
        this.add(this.panel);
      }
      this.panel.add(con);
    },

    addContent: function(tb) {

      var me = this;

      me.subscribe(me, Rally.Message.objectUpdate, me._onObjectUpdated, me);

      Ext.create('Rally.data.WsapiDataStore', {
        limit : "Infinity",
        autoLoad: true,
        model: 'TypeDefinition',
        filters: [{
          property: 'TypePath',
          operator: '=',
          value: 'HierarchicalRequirement'
        }],
        fetch: ['Attributes', 'ElementName', 'AllowedValues', 'StringValue'],
        listeners: {
          load: function (store, recs, success) {

            Ext.Array.each(recs[0].get('Attributes'), function (attribute) {
              if (attribute.ElementName !== 'ScheduleState') { return; }
              me.scheduleStates = [];
              Ext.Array.each(attribute.AllowedValues, function (value) {
                if (value.StringValue) {
                  me.scheduleStates.push(value.StringValue);
                }
              });
            });
            me.fireEvent('scheduleStatesLoaded', me.scheduleStates);
          }
        }
      });

      me.on('scheduleStatesLoaded', function (states) {
        var colors = {};
        var rules = [];

        Ext.Object.each(me.settings, function(k, v) {
          if (k.indexOf('state-color-') !== -1) {
            colors[k.replace('state-color-', '')] = v;
          }
        });

        Ext.Object.each(colors, function (k, v) {
          rules.push(
            '.story.state-' + k + ' {' +
            '  background-color: ' + v + ';' +
            '}'
          );
        });

        Ext.util.CSS.createStyleSheet(rules.join('\n'), 'generated');
      });

      Ext.create('Rally.data.WsapiDataStore', {
        autoLoad: true,
        remoteFilter: false,
        limit : "Infinity",
        model: 'TypeDefinition',
        sorters: [{
          property: 'Ordinal',
          direction: 'Desc'
        }],
        filters: [{
          property: 'Parent.Name',
          operator: '=',
          value: 'Portfolio Item'
        }, {
          property: 'Creatable',
          operator: '=',
          value: 'true'
        }],
        listeners: {
          load: function (store, recs) {
            me.piTypes = {};

            _.each(recs, function (type) {
              me.piTypes[type.get('Ordinal') + ''] = type;
            });
            me.onScopeChange(tb);
          },
          scope: me
        }
      });

      me.on('load', function (projects, initiatives, features, stories) {
        me._onLoad(projects, initiatives, features, stories);
      });
    },

    onScopeChange: function (tb) {
      var me = this;
      app = this;

      console.log('Scope changed',tb);

      if (!_.isUndefined(this.panel)&&!_.isNull(this.panel))
        this.panel.removeAll(true);

      me.initiatives = null;
      me.features = null;
      me.stories = null;
      me.projects = null;

      // me.removeAll(true);

      if (_.isUndefined(me.piTypes))
        me.addContent(tb);
      else
        // me.doit(scope);
        me.loadData(tb);
    },

    loadData: function (tb) {
      var me = this;
      var featureName = me.piTypes['0'].get('ElementName');

      me.showMask("Loading data for " + tb.getRecord().get('Name') + "...");

      Ext.create('Rally.data.WsapiDataStore', {
        model: me.piTypes['0'].get('TypePath'),
        limit : "Infinity",
        autoLoad: true,
        fetch: ['ObjectID', 'FormattedID', 'Name', 'Value', 'Parent', 'Project', 'UserStories', 'Children', 'PreliminaryEstimate', 'DirectChildrenCount', 'LeafStoryPlanEstimateTotal', 'DisplayColor'],
        filters: tb.getQueryFilter(),
        sorters: [{
          property: 'Rank',
          direction: 'ASC'
        }],
        listeners: {
          load: me._featuresLoaded,
          scope: me
        }
      });

      Ext.create('Rally.data.WsapiDataStore', {
        model: 'HierarchicalRequirement',
        limit : "Infinity",
        autoLoad: true,
        fetch: ['ObjectID', 'FormattedID', 'Name', 'ScheduleState', 'PlanEstimate', 'Feature', 'Parent', 'Project', 'Blocked', 'BlockedReason', 'Iteration', 'StartDate', 'EndDate', 'AcceptedDate', 'Predecessors', 'Successors'],
        filters: [{
          property: featureName + '.Release.Name',
          value: tb.getRecord().get('Name')
        }, {
          property: featureName + '.Release.ReleaseStartDate',
          value: tb.getRecord().raw.ReleaseStartDate
        }, {
          property: featureName + '.Release.ReleaseDate',
          value: tb.getRecord().raw.ReleaseDate
        }, {
          property: 'DirectChildrenCount',
          value: 0
        }],
        sorters: [{
          property: 'Rank',
          direction: 'ASC'
        }],
        listeners: {
          load: me._storiesLoaded,
          scope: me
        }
      });

      Ext.create('Rally.data.WsapiDataStore', {
        model: 'Project',
        limit : 'Infinity',
        autoLoad: true,
        fetch: true,
        listeners: {
          load: me._projectsLoaded,
          scope: me
        }
      });
    },

    _projectsLoaded: function (store, recs, success) {
      // console.log('Projects loaded', recs, _.map(recs,function(r){return r.get("Name")}));
      var me         = this;

      me.projects    = {};
      me.projectRecs = recs;

      Ext.Array.each(recs, function (elt) {
        me.projects[parseInt(elt.get('ObjectID') + '', 10)] = elt;
      });

      if (me.stories && me.features && me.initiatives && me.projects) {
        me.fireEvent('load', me.projects, me.initiatives, me.features, me.stories);
      }
    },

    _featuresLoaded: function (store, recs, success) {
      //console.log('Features loaded', recs);
      var me          = this;
      var initiatives = {};
      var query       = [];
      var filter      = "";

      me.features             = {};
      me.featureRecs          = recs;
      me.featuresByInitiative = {};

      Ext.Array.each(recs, function(elt) {
        var iid;

        if (!elt) {
          return;
        }

        if (elt.get('Parent') && elt.get('Parent')._ref) {
          iid = Rally.util.Ref.getOidFromRef(elt.get('Parent')._ref);
          initiatives[iid] = 1;
        } else {
          iid = 0;
        }

        me.features[parseInt(elt.get('ObjectID') + '', 10)] = elt;
        me.featuresByInitiative[iid] = me.featuresByInitiative[iid] || {};
        me.featuresByInitiative[iid][elt.get('ObjectID')] = elt;
      });

      Ext.Object.each(initiatives, function(key) {
        query.push({property: 'ObjectID', operator: '=', value: key});
      });

      if (query.length > 0) {
        filter = Rally.data.QueryFilter.or(query);
      } else {
        //console.log("No initiatives found", query);
      }

      Ext.create('Rally.data.WsapiDataStore', {
        limit : "Infinity",
        model: me.piTypes['1'].get('TypePath'),
        autoLoad: true,
        filters: filter,
        fetch: ['FormattedID', 'Name', 'PreliminaryEstimate', 'Value', 'Children', 'Project', 'DisplayColor'],
        context: {
          workspace: me.getContext().getDataContext().workspace,
          project: null, //me.getContext().getDataContext().project,
          projectScopeUp: true,
          projectScopeDown: true
        },
        sorters: [{
          property: 'Rank',
          direction: 'ASC'
        }],
        listeners: {
          load: me._initiativesLoaded,
          scope: me
        }
      });

      if (me.stories && me.features && me.initiatives && me.projects) {
        me.fireEvent('load', me.projects, me.initiatives, me.features, me.stories);
      }
    },

    _storiesLoaded: function (store, recs, success) {
      
      console.log('Stories loaded', recs);

      var me       = this;

      me.stories   = {};
      me.storyRecs = recs;

      Ext.Array.each(recs, function(elt) {
        me.stories[parseInt(elt.get('ObjectID') + '', 10)] = elt;

      });

      if (me.stories && me.features && me.initiatives && me.projects) {
        me.fireEvent('load', me.projects, me.initiatives, me.features, me.stories);
      }
    },

    _initiativesLoaded: function (store, recs, success) {
      //console.log('Initiatives loaded', recs);
      var me = this;
      var nullInitiative;

      me.initiatives    = {};
      me.initiativeRecs = recs;

      Ext.Array.each(recs, function(elt) {
        me.initiatives[parseInt(elt.get('ObjectID') + '', 10)] = elt;
      });

      Rally.data.ModelFactory.getModel({
        type: me.piTypes['1'].get('TypePath'),
        success: function (model) {
          var blank = Ext.create(model, {
            ObjectID: 0,
            Name: '(No ' + me.piTypes['1'].get('ElementName') + ')'
          });

          me.initiatives[0] = blank;
          me.initiativeRecs.push(blank);
          if (me.stories && me.features && me.initiatives && me.projects) {
            me.fireEvent('load', me.projects, me.initiatives, me.features, me.stories);
          }
        }
      });
    },

    _onLoad: function (projects, initiatives, features, stories) {
      //console.log('All data loaded. Time to process it');
      var me = this;

      me.hideMask();

      me.projectsByStory      = {};
      me.projectsByFeature    = {};
      me.projectsByInitiative = {};

      me.storyByProject      = {};
      me.featureByProject    = {};
      me.initiativeByProject = {};

      me.totalPoints              = 0;
      me.totalCompletedPoints     = 0;
      me.totalAcceptedPoints      = 0;
      me.totalStoriesNotEstimated = 0;

      me.projectList = {};

      Ext.Object.each(stories, function (oid, story) {
        var featureOid    = Rally.util.Ref.getOidFromRef(story.get('Feature')._ref);
        var projectOid    = Rally.util.Ref.getOidFromRef(story.get('Project')._ref);
        var initiativeOid;

        if (!features.hasOwnProperty(featureOid)) { return; }

        if (features[featureOid].get('Parent')) {
          initiativeOid = Rally.util.Ref.getOidFromRef(features[featureOid].get('Parent')._ref);
        } else {
          initiativeOid = 0;
        }

        if (!isNaN(parseInt(story.get('PlanEstimate') + '', 10))) {
          me.totalPoints = me.totalPoints + parseInt(story.get('PlanEstimate') + '', 10);

          if ((story.get('ScheduleState') === 'Accepted') || (story.get('ScheduleState') === 'Released')) {
            me.totalAcceptedPoints = me.totalAcceptedPoints + parseInt(story.get('PlanEstimate') + '', 10);
            me.totalCompletedPoints = me.totalCompletedPoints + parseInt(story.get('PlanEstimate') + '', 10);
          } else if (story.get('ScheduleState') === 'Completed') {
            me.totalCompletedPoints = me.totalCompletedPoints + parseInt(story.get('PlanEstimate') + '', 10);
          }
        } else {
          me.totalStoriesNotEstimated++;
        }

        oid           = parseInt(oid + '', 10);
        featureOid    = parseInt(featureOid + '', 10);
        initiativeOid = parseInt(initiativeOid + '', 10);
        projectOid    = parseInt(projectOid + '', 10);

        me.projectList[projectOid] = 1;

        me.projectsByStory[oid]                = me.projectsByStory[oid] || {};
        me.projectsByFeature[featureOid]       = me.projectsByFeature[featureOid] || {};
        me.projectsByInitiative[initiativeOid] = me.projectsByInitiative[initiativeOid] || {};

        me.projectsByStory[oid][projectOid]                = 1;
        me.projectsByFeature[featureOid][projectOid]       = 1;
        me.projectsByInitiative[initiativeOid][projectOid] = 1;

        me.storyByProject[projectOid]      = me.storyByProject[projectOid] || {};
        me.featureByProject[projectOid]    = me.featureByProject[projectOid] || {};
        me.initiativeByProject[projectOid] = me.initiativeByProject[projectOid] || {};

        me.storyByProject[projectOid][oid]                = 1;
        me.featureByProject[projectOid][featureOid]       = 1;
        me.initiativeByProject[projectOid][initiativeOid] = 1;
      });

      Ext.Array.each(me.featureRecs, function (feature) {
        var featureOid    = feature.get('ObjectID');
        var projectOid    = Rally.util.Ref.getOidFromRef(feature.get('Project')._ref);
        var initiativeOid;

        if (feature.get('Parent')) {
          initiativeOid = Rally.util.Ref.getOidFromRef(feature.get('Parent')._ref);
        } else {
          initiativeOid = 0;
        }

        me.projectList[projectOid] = 1;
        me.projectsByFeature[featureOid]       = me.projectsByFeature[featureOid] || {};
        me.projectsByInitiative[initiativeOid] = me.projectsByInitiative[initiativeOid] || {};

        if (feature.get('DirectChildrenCount') !== 0) {
          return;
        }

        me.projectsByFeature[featureOid][projectOid]       = 1;
        me.projectsByInitiative[initiativeOid][projectOid] = 1;

        me.featureByProject[projectOid]    = me.featureByProject[projectOid] || {};
        me.initiativeByProject[projectOid] = me.initiativeByProject[projectOid] || {};

        me.featureByProject[projectOid][featureOid]       = 1;
        me.initiativeByProject[projectOid][initiativeOid] = 1;
      });

      me.addToContainer({
        xtype: 'box',
        layout: 'fit',
        html: me.headerTemplate.apply({
          width:        (Ext.get(me.getEl()).getWidth() - 10) + "px",
          name:         this.getContext().getTimeboxScope().getRecord().get('Name'),
          accepted:     me.totalAcceptedPoints,
          completed:    me.totalCompletedPoints,
          total:        me.totalPoints,
          notEstimated: me.totalStoriesNotEstimated
        })
      });

      Ext.Object.each(me.projectList, function (projectId, __) {
        //console.log('Adding project', projectId, me.projects[projectId].get('Name'));
        me.addToContainer(me.addProject(projectId));
      });
    },

    addProject: function (projectId) {
      //console.log('Adding project', projectId);
      var me = this;
      // console.log("projects", projectId,me.projects);
      var cls = Ext.isIE ? 'rotate rotate-ie' : 'rotate';

      var container = Ext.create('Ext.container.Container', {
        layout: {
          type: 'hbox',
          align: 'stretchmax'
        },
        items: [{
          xtype: 'box',
          cls: Ext.isIE ? 'rotate-parent' : 'rotate-parent',
          html: '<div class="' + cls + '">' + me.projects[projectId].get('Name') + '</div>'
        }]
      });

      Ext.Array.each(me.initiativeRecs, function (initiative) {
        var initiativeId = initiative.data.ObjectID + '';

        if (me.projectsByInitiative[initiativeId]) {
          if (me.projectsByInitiative[initiativeId][projectId]) {
            container.add(me.addInitiative(projectId, initiativeId));
          }
        }
      });

      return container;
    },

    addInitiative: function (projectId, initiativeId) {
      //console.log('Adding initiative', initiativeId);

      var me = this;
      var data = {};
      var iid;

      //console.log('Initiative', initiativeId, me.initiatives[initiativeId]);

      if (!me.initiatives[initiativeId]) { return; }

      data.type    = 'initiative';
      data.name    = me.initiatives[initiativeId].get('Name');
      data.fidLink = me.fidTemplate.getLink({record: me.initiatives[initiativeId].data, text: me.initiatives[initiativeId].get('FormattedID'), showHover: false});

      var container = Ext.create('Ext.container.Container', {
        layout: {
          type: 'vbox',
          align: 'stretch'
        },
        items: [{
          xtype: 'box',
          html: me.cardTemplate.apply(data)
        }]
      });

      var featureContainer = Ext.create('Ext.container.Container', {
        layout: {
          type: 'hbox'
        }
      });

      container.add(featureContainer);

      Ext.Array.each(me.featureRecs, function (feature) {
        var featureId = feature.data.ObjectID;

        if (!me.projectsByFeature[featureId]) {
          return;
        }

        if (!me.projectsByFeature[featureId][projectId]) {
          return;
        }

        if (me.features[featureId].get('Parent')) {
          iid = Rally.util.Ref.getOidFromRef(me.features[featureId].get('Parent')._ref) + '';
        } else {
          iid = '0';
        }

        if (initiativeId === iid) {
          featureContainer.add(me.addFeature(projectId, initiativeId, featureId));
        }
      });

      return container;
    },

    _dataForFeature: function (record) {
      var me = this;
      var data = {};

      data.type        = 'feature';
      data.oid         = record.get('ObjectID');
      data._ref        = record.get('_ref');
      data.name        = record.get('Name');
      data.size        = '';
      data.storySize   = record.get('LeafStoryPlanEstimateTotal') || 0;
      data.featureSize = 0;
      if (record.get('PreliminaryEstimate')) {
        data.featureSize = record.get('PreliminaryEstimate').Value;
      }
      if (data.featureSize) {
        data.size = data.featureSize + ' FP';
      }
      if (data.featureSize && data.storySize) {
        data.size = data.size + ' / ';
      }
      if (data.storySize) {
        data.size = data.size + data.storySize + ' SP';
      }
      data.color   = record.raw.Parent ? record.raw.Parent.DisplayColor || 'black' : 'black';
      data.fidLink = me.fidTemplate.getLink({record: record.data, text: record.get('FormattedID'), showHover: false});

      return data;
    },

    addFeature: function (projectId, initiativeId, featureId) {
      //console.log('Adding Feature', featureId);

      var me      = this;
      var i       = 0;
      var spc     = parseInt(me.getSetting('storyCardsPerColumn') + '', 10);
      var data    = me._dataForFeature(me.features[featureId]);
      var storyContainer;
      var storyColumnContainer;

      var container = Ext.create('Ext.container.Container', {
        layout: {
          type: 'vbox',
          align: 'stretch'
        },
        items: [{
          xtype: 'container',
          layout: 'table',
          oid: featureId,
          items: [{
            xtype: 'box',
            html: me.cardTemplate.apply(data)
          }],
          listeners: {
            afterrender: function (t) {
              var d = this;
              t.getEl().on('mousedown', function (e) {
                e.preventDefault();
              });

              t.getEl().on('dblclick', function(e) {
                e.preventDefault();
                //console.log('hi', d);
                Rally.nav.Manager.edit(d._ref);
                return false;
              });
            },
            scope: (function (d) { return d; }(data))
          }
        }]
      });

      storyContainer = Ext.create('Ext.container.Container', {
        layout: {
          type: 'hbox'
        }
      });

      container.add(storyContainer);

      // console.log(_.map(me.storyRecs,function(s){return s.raw.Predecessors.length}));

      Ext.Array.each(me.storyRecs, function (story) {
        var storyId = story.data.ObjectID;
        var parentId = Rally.util.Ref.getOidFromRef(story.get('Feature')._ref);

        if (!me.projectsByStory[storyId]) {
          return;
        }

        if (!me.projectsByStory[storyId][projectId]) {
          return;
        }

        if (parseInt(featureId + '', 10) !== parseInt(parentId + '', 10)) {
          return;
        }

        if (i >= spc) {
          i = 0;
        }

        if (i === 0) {
          storyColumnContainer = Ext.create('Ext.container.Container', {
            layout: {
              type: 'vbox'
            }
          });

          storyContainer.add(storyColumnContainer);
        }

        storyColumnContainer.add(me.addStory(storyId));
        i++;
      });

      return container;
    },

    _dataForStory: function (record) {
      var iStart;
      var iEnd;
      var me   = this;
      var now  = new Date();
      var data = {
        name:    record.get('Name'),
        oid:     record.get('ObjectID'),
        _ref:    record.get('_ref'),
        size:    record.get('PlanEstimate'),
        state:   ('' + record.get('ScheduleState')).toLowerCase(),
        type:    'story',
        blocked: record.get('Blocked') ? 'blocked' :'',

        iterationStatus: 'unplanned',

        fidLink: me.fidTemplate.getLink({record: record.data, text: record.get('FormattedID'), showHover: false}),

        _record: record
      };

      if (record.raw.Iteration) {
        data.iterationStatus = 'planned';

        iStart = Rally.util.DateTime.fromIsoString(record.raw.Iteration.StartDate);
        iEnd = Rally.util.DateTime.fromIsoString(record.raw.Iteration.EndDate);

        if (Rally.util.DateTime.getDifference(now, iStart, 'day') >= 0) {
          data.iterationStatus = 'active';
          if (!!record.raw.AcceptedDate /*|| (!record.raw.PlanEstimate)*/) {
            data.iterationStatus = 'done';
          }
        }

        if (Rally.util.DateTime.getDifference(now, iEnd, 'day') > 0) {
          if (!!record.raw.AcceptedDate /*|| (!record.raw.PlanEstimate)*/) {
            data.iterationStatus = 'done';
          } else {
            data.iterationStatus = 'late';
          }
        }
      }

      data.pred_succ = '';
      if (record.raw.Predecessors.length) {
        data.pred_succ = "pred";
        if (_.some(record.raw.Predecessors, function (itm) { return !_.contains(['Accepted', 'Released'], itm.ScheduleState); })) {
          data.pred_succ = "pred_open";
        }
      }

      var recDate;
      if (record.raw.Iteration) {
        recDate = Rally.util.DateTime.fromIsoString(record.raw.Iteration.EndDate);
      }
      if (record.raw.Successors.length) {
        data.pred_succ = data.pred_succ ? data.pred_succ + '_succ' : 'succ';
        if (recDate) {
          if (_.some(record.raw.Predecessors, function (itm) {
            if (!itm.Iteration) { return false; }

            var date = Rally.util.DateTime.fromIsoString(itm.Iteration.EndDate);
            return Rally.util.DateTime.getDifference(recDate, date, 'day') > 0;
          })) {
            data.pred_succ = data.pred_succ + '_need';
          }
        }
      }
      // console.log(data,data.pred_succ);
      return data;
    },

    addStory: function (storyId) {
      var me   = this;
      var data = me._dataForStory(me.stories[storyId]);

      var container = Ext.create('Ext.container.Container', {
        layout: {
          type: 'hbox'
        },
        items: [{
          xtype: 'container',
          layout: 'table',
          oid: storyId,
          items: [{
            xtype: 'box',
            html: me.cardTemplate.apply(data)
          }],
          listeners: {
            afterrender: function (t) {
              var d = this;
              var linkIndicator = t.getEl().select('div.link_indicator').first();

              t.getEl().on('mousedown', function (e) {
                e.preventDefault();
              });

              t.getEl().on('dblclick', function(e) {
                e.preventDefault();
                Rally.nav.Manager.edit(d._ref);
                return false;
              });

              if (linkIndicator) {
                linkIndicator.on('click', (function (li, sid) { 
                  var preds = me.stories[sid].raw.Predecessors;
                  var succs = me.stories[sid].raw.Successors;

                  return function (e) {
                    e.preventDefault();
                    var useLocal = false;
                    var bottom = li.getBottom(useLocal);
                    var left = li.getLeft(useLocal);
                    var width = li.getWidth(useLocal);
                    var path;
                    var predCards = _(preds).map(function (p) { return Ext.query('.oid-' + p.ObjectID); }).flatten();
                    var succCards = _(succs).map(function (p) { return Ext.query('.oid-' + p.ObjectID); }).flatten();
                    var topOffset = me.viewportDiv.dom.parentNode.scrollTop;

                    //console.log('expand indicator', sid, li.getBottom(useLocal), li.getLeft(useLocal), li.getWidth(useLocal));
                    //console.log('XY', me.viewportDiv.dom);
                    //console.dir(me.viewportDiv.dom);
                    //console.dir(succCards);

                    if (me.links) {
                      _(me.links).each(function (l) { l.remove(); });
                      me.links = null;
                    } else {
                      me.links = [];
                      predCards.each(function (c) {
                        var target = Ext.get(c);
                        path = [];
                        path.push(['M', left + (~~(width / 2)), topOffset + bottom]);
                        path.push(['C', left, topOffset + target.getBottom(useLocal) + 100, target.getLeft(useLocal), topOffset + target.getBottom(useLocal) + 50, target.getLeft(useLocal) + 10, topOffset + target.getBottom(useLocal)]);

                        me.links.push(me.canvas.path(path).attr({stroke: 'blue', 'stroke-width': 3}));
                      });
                      succCards.each(function (c) {
                        var target = Ext.get(c);
                        var p;
                        path = [];
                        path.push(['M', left + (~~(width / 2)), topOffset + bottom]);
                        path.push(['C', left, topOffset + target.getBottom(useLocal) + 100, target.getLeft(useLocal), topOffset + target.getBottom(useLocal) + 50, target.getLeft(useLocal) + 10, topOffset + target.getBottom(useLocal)]);

                        p = me.canvas.path(path).attr({stroke: 'grey', 'stroke-width': 3});
                        me.links.push(p);
                      });
                      if (me.links.length === 0) { me.links = null; }
                    }

                    return false;
                  };
                })(linkIndicator, storyId));
              }
            },
            scope: (function (d) { return d; }(data))
          }
        }]
      });

      return container;
    },

    _refreshCard: function (record, dataFn) {
      var me = this;
      var cards = this.query('component[oid=' +  record.get('ObjectID') + ']');
      var data = dataFn(record);

      //console.log(cards);
      _.each(cards, function (c) {
        c.removeAll();
        c.add({
          xtype: 'box',
          html: me.cardTemplate.apply(data)
        });
      });

    },

    _onObjectUpdated: function (record) {
      var me = this;
      var m = record.getProxy().getModel();
      var fetch, fetchS, fetchF;
      var dataFn;

      fetchF = ['ObjectID', 'FormattedID', 'Name', 'Value', 'Parent', 'Project', 'UserStories', 'Children', 'PreliminaryEstimate', 'DirectChildrenCount', 'LeafStoryPlanEstimateTotal', 'DisplayColor'];
      fetchS = ['ObjectID', 'FormattedID', 'Name', 'ScheduleState', 'PlanEstimate', 'Feature', 'Parent', 'Project', 'Blocked', 'BlockedReason', 'Iteration', 'StartDate', 'EndDate', 'AcceptedDate', 'Predecessors', 'Successors'];

      if (record.get('_type').toLowerCase().indexOf('portfolioitem') !== -1) {
        fetch = fetchF;
        dataFn = Ext.Function.bind(me._dataForFeature, me);
      } else {
        fetch = fetchS;
        dataFn = Ext.Function.bind(me._dataForStory, me);
      }

      me.showMask('Updating...');
      m.load(record.get('ObjectID'), {
        fetch: fetch,
        callback: function (result) {
          me._refreshCard(result, dataFn);

          if (result.get('_type').toLowerCase() === 'hierarchicalrequirement') {
            Rally.data.ModelFactory.getModel({
              type: me.piTypes['0'].get('TypePath'),
              success: function (feature) {
                feature.load(result.get(me.piTypes['0'].get('ElementName')).ObjectID, {
                  fetch: fetchF,
                  callback: function (f) {
                    me._refreshCard(f, Ext.Function.bind(me._dataForFeature, me));
                    me.hideMask();
                  }
                });
              }
            });
          } else {
            me.hideMask();
          }
        }
      });
    }
});
