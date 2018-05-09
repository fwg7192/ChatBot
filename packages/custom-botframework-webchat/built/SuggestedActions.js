"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var React = require("react");
var react_redux_1 = require("react-redux");
var Chat_1 = require("./Chat");
var HScroll_1 = require("./HScroll");
var Store_1 = require("./Store");
var SuggestedActionsContainer = /** @class */ (function (_super) {
    tslib_1.__extends(SuggestedActionsContainer, _super);
    function SuggestedActionsContainer(props) {
        return _super.call(this, props) || this;
    }
    SuggestedActionsContainer.prototype.actionClick = function (e, cardAction) {
        if (!this.props.activityWithSuggestedActions)
            return;
        this.props.takeSuggestedAction(this.props.activityWithSuggestedActions);
        this.props.doCardAction(cardAction.type, cardAction.value);
        e.stopPropagation();
    };
    SuggestedActionsContainer.prototype.shouldComponentUpdate = function (nextProps) {
        return !nextProps.activityWithSuggestedActions != !this.props.activityWithSuggestedActions;
    };
    SuggestedActionsContainer.prototype.render = function () {
        var _this = this;
        if (!this.props.activityWithSuggestedActions)
            return null;
        return (React.createElement("div", { className: "wc-suggested-actions" },
            React.createElement(HScroll_1.HScroll, { prevSvgPathData: "M 16.5 22 L 19 19.5 L 13.5 14 L 19 8.5 L 16.5 6 L 8.5 14 L 16.5 22 Z", nextSvgPathData: "M 12.5 22 L 10 19.5 L 15.5 14 L 10 8.5 L 12.5 6 L 20.5 14 L 12.5 22 Z", scrollUnit: "page" },
                React.createElement("ul", null, this.props.activityWithSuggestedActions.suggestedActions.actions.map(function (action, index) {
                    return React.createElement("li", { key: index },
                        React.createElement("button", { type: "button", onClick: function (e) { return _this.actionClick(e, action); }, title: action.title }, action.title));
                })))));
    };
    return SuggestedActionsContainer;
}(React.Component));
function activityWithSuggestedActions(activities) {
    if (!activities || activities.length === 0)
        return;
    var lastActivity = activities[activities.length - 1];
    if (lastActivity.type === 'message'
        && lastActivity.suggestedActions
        && lastActivity.suggestedActions.actions.length > 0)
        return lastActivity;
}
exports.SuggestedActions = react_redux_1.connect(function (state) { return ({
    // passed down to MessagePaneView
    activityWithSuggestedActions: activityWithSuggestedActions(state.history.activities),
    // only used to create helper functions below
    botConnection: state.connection.botConnection,
    user: state.connection.user,
    locale: state.format.locale
}); }, {
    takeSuggestedAction: function (message) { return ({ type: 'Take_SuggestedAction', message: message }); },
    // only used to create helper functions below
    sendMessage: Store_1.sendMessage
}, function (stateProps, dispatchProps, ownProps) { return ({
    // from stateProps
    activityWithSuggestedActions: stateProps.activityWithSuggestedActions,
    // from dispatchProps
    takeSuggestedAction: dispatchProps.takeSuggestedAction,
    // helper functions
    doCardAction: Chat_1.doCardAction(stateProps.botConnection, stateProps.user, stateProps.locale, dispatchProps.sendMessage),
}); })(SuggestedActionsContainer);
//# sourceMappingURL=SuggestedActions.js.map