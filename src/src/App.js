import React from 'react';
import {withStyles} from '@material-ui/core/styles';
import AppBar from '@material-ui/core/AppBar';
import GenericApp from "@iobroker/adapter-react/GenericApp";
import Connection from "./components/Connection";
import SceneForm from "./components/SceneForm";
import SceneMembersForm from "./components/SceneMembersForm";
import Loader from '@iobroker/adapter-react/Components/Loader'
import { PROGRESS } from './components/Connection';
import Paper from '@material-ui/core/Paper';
import Grid from '@material-ui/core/Grid';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Switch from '@material-ui/core/Switch';
import Container from '@material-ui/core/Container';
import Fab from '@material-ui/core/Fab';
import clsx from 'clsx';
import Utils from '@iobroker/adapter-react/Components/Utils';
import I18n from '@iobroker/adapter-react/i18n';
import {MdAdd as IconAdd} from 'react-icons/md';
import {MdModeEdit as IconEdit} from 'react-icons/md';
import {RiFolderAddLine as IconFolderAdd} from 'react-icons/ri';
import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';

const LEVEL_PADDING = 24;

const styles = theme => ({
    root: {
    },
    tabContent: {
        padding: 10,
        height: 'calc(100% - 64px - 48px - 20px)',
        overflow: 'auto'
    },
    
});

function getUrlQuery() {
    const parts = (window.location.search || '').replace(/^\?/, '').split('&');
    const query = {};
    parts.forEach(item => {
        const [name, val] = item.split('=');
        query[decodeURIComponent(name)] = val !== undefined ? decodeURIComponent(val) : true;
    });
    return query;
}

class App extends GenericApp {
    constructor(props) {
        super(props);
        this.translations = {
            'en': require('./i18n/en'),
            'de': require('./i18n/de'),
            'ru': require('./i18n/ru'),
            'pt': require('./i18n/pt'),
            'nl': require('./i18n/nl'),
            'fr': require('./i18n/fr'),
            'it': require('./i18n/it'),
            'es': require('./i18n/es'),
            'pl': require('./i18n/pl'),
            'zh-cn': require('./i18n/zh-cn'),
        };

        // init translations
        I18n.setTranslations(this.translations);
        I18n.setLanguage((navigator.language || navigator.userLanguage || 'en').substring(0, 2).toLowerCase());
        this.adapterName = 'scenes';

        const query = getUrlQuery();

        this.port = query.port || (window.location.port === '3000' ? 8081 : window.location.port);
        this.host = query.host || window.location.hostname;

        window.iobForceHost = this.host;
    }

    componentDidMount() {
        this.socket = new Connection({
            name: this.adapterName,
            host: this.host,
            port: this.port || this.getPort(),
            onProgress: progress => {
                if (progress === PROGRESS.CONNECTING) {
                    this.setState({
                        connected: false
                    });
                } else if (progress === PROGRESS.READY) {
                    this.setState({
                        connected: true,
                        progress: 100
                    });
                } else {
                    this.setState({
                        connected: true,
                        progress: Math.round(PROGRESS.READY / progress * 100)
                    });
                }
            },
            onReady: async (objects, scripts) => {
                I18n.setLanguage(this.socket.systemLang);

                console.log(objects);
                console.log(scripts);
                const newState = {
                    lang: this.socket.systemLang,
                    ready: true,
                };

                try {
                    newState.systemConfig = await this.socket.getSystemConfig();
                } catch (error) {
                    console.log(error);
                }

                this.refreshData();
            },
            //onObjectChange: (objects, scripts) => this.onObjectChange(objects, scripts),
            onObjectChange: (attr, value) => ()=>{console.log(attr); console.log(value);},
            onError: error => {
                console.error(error);
                this.showError(error);
            }
        });
    }

    sceneSwitch = (event) => {
        this.state.scenes[event.target.name].common.enabled = event.target.checked;
        this.socket.setObject(event.target.name, this.state.scenes[event.target.name]);
        this.setState(this.state);
      };

    buildTree(scenes) {
        scenes = Object.values(scenes);

        let folders = {subfolders: {}, scenes: {}, id: "", prefix: ""};

        // create missing folders
        scenes.forEach((scene) => {
            let id = scene._id;
            const parts = id.split('.');
            parts.shift();
            parts.shift();
            let current_folder = folders;
            let prefix = "";
            for (let i = 0; i < parts.length - 1; i++) {
                if (prefix != "") {
                    prefix = prefix + ".";
                }
                prefix = prefix + parts[i];
                if (!current_folder.subfolders[parts[i]]) {
                    current_folder.subfolders[parts[i]] = {subfolders: {}, scenes: {}, id: parts[i], prefix: prefix}
                }
                current_folder = current_folder.subfolders[parts[i]];
            }
            current_folder.scenes[id] = scene;
        });

        return folders;
    }

    getData() {
        let scenes;
        return this.socket.getObjectView('scene.' + this.instance + '.', 'scene.' + this.instance + '.\u9999', 'state')
            .then(_scenes => {
                console.log(_scenes);
                scenes = _scenes;
                return {scenes, folders: this.buildTree(scenes)};
            });
    }
    refreshData() {
        this.setState({scenes: {}, ready: false});
        this.getData()
        .then(newState => {
                newState.ready = true;
                console.log(this.state);
                console.log(newState);
                this.setState(newState);
            });
    }

    addFolder(parent_folder, id) {
        parent_folder.subfolders[id] = {scenes: {}, subfolders: {}, id: id, prefix : parent_folder.prefix ? parent_folder.prefix + "." + id : id};
        this.setState(this.state);
    }

    addSceneToFolder = (scene, folder) => {
        this.addSceneToFolderPrefix(scene, folder.prefix);
    }

    addSceneToFolderPrefix = async (scene, folderPrefix, noRefresh) => {
        let old_id = scene._id;
        let scene_id = scene._id.split(".").pop();
        scene._id = "scene." + this.instance + "." + folderPrefix + (folderPrefix ? "." : "") + scene_id;
        if (!noRefresh) {
            this.setState({selectedSceneId: null});
        }
        await this.socket.delObject(old_id);
        await this.socket.setObject(scene._id, scene);
        if (!noRefresh) {
            this.refreshData();
            this.setState({selectedSceneId: scene._id});
        }
    }


    renameFolder = async (folder, newName) => {
        this.setState({selectedSceneId: null, ready: false});
        for (let k in folder.scenes)
        {
            let prefix = folder.prefix.split(".")
            prefix[prefix.length - 1] = newName;
            prefix.join(".");
            await this.addSceneToFolderPrefix(folder.scenes[k], prefix, true);
        };
        this.refreshData();
    }

    deleteFolder(folder) {
        if (Object.values(folder.scenes).length) {
            return this.showError(I18n.t('Cannot delete non-empty folder'));
        } else {
            //delete folder;
            this.setState(this.state);
        }
    }

    deleteScript(id) {
        const scripts = JSON.parse(JSON.stringify(this.state.scripts));
        if (scripts[id]) {
            delete scripts[id];

            this.socket.delObject(id, () =>
                this.setState({scripts, tree: this.buildTree(null, scripts)}));
        }
    }

    renderTreeScene = (item, level) => {
        const scene = this.state.scenes[item._id];
        let component = this;
        level = 0;

        return <div key={item.id} className={this.state.selectedSceneId && this.state.selectedSceneId == scene._id ? "selectedScene" : ""} style={{paddingLeft: level * LEVEL_PADDING}} key={scene._id} onClick={()=>{
            component.setState({selectedSceneId: scene._id});
        }}>
            <h3>{ scene.common.name }
                <span className="right"><Switch
                    checked={scene.common.enabled}
                    onChange={component.sceneSwitch}
                    name={scene._id}
                /></span>
            </h3>
            <div>{ Utils.getObjectNameFromObj(scene, null, {language: I18n.getLanguage()}) }</div>
            <div>{scene.common.desc}</div>
        </div>;
    }
    
    renderTree = (parent) => {
        let result = []
        result.push(<h2>{parent.id}
        {
            parent.id ? 
            <span className="right">
                <Fab size="small" color="secondary" aria-label="Add" onClick={()=>{
                    this.setState({addFolderDialog: parent, addFolderDialogTitle: ""});
                }} title={I18n.t('Create new folder')}><IconFolderAdd /></Fab>
                <Fab size="small" color="secondary" aria-label="Edit" onClick={()=>{
                    this.setState({editFolderDialog: parent, editFolderDialogTitle: parent.id});
                }} title={I18n.t('Edit folder')}><IconEdit /></Fab>
            </span>
            : null
        }
        </h2>);
        result.push(
            <div style={{paddingLeft: "20px"}}>
                {Object.values(parent.scenes).map(this.renderTreeScene)}
                {Object.values(parent.subfolders).map(this.renderTree)}
            </div>
        );

        return result;
    }

    createScene = (name) => {
        let template = {
            "common": {
              "name": "",
              "type": "boolean",
              "role": "scene.state",
              "desc": "",
              "enabled": true,
              "read": true,
              "write": true,
              "def": false,
              //"engine": "system.adapter.scenes.0"
            },
            "native": {
              "onTrue": {
                "trigger": {},
                "cron": null,
                "astro": null
              },
              "onFalse": {
                "enabled": false,
                "trigger": {},
                "cron": null,
                "astro": null
              },
              "members": []
            },
            "type": "state"
          };
          template.common.desc = template.common.name = name;
          this.socket.setObject("scene." + this.instance + "." + template.common.name, template);
          this.refreshData();
    }

    cloneScene = (id) => {
        let scene = JSON.parse(JSON.stringify(this.state.scenes[id]));
        scene._id = scene._id + "_clone"
        scene.common.name = scene.common.name + " clone";
        this.socket.setObject(scene._id, scene);
        this.setState(this.state);
        this.refreshData();
    }

    updateScene = (id, data) => {
        this.state.scenes[id] = data;
        this.socket.setObject(id, this.state.scenes[id]);
        this.setState(this.state);
        console.log(this.state);
        this.refreshData();
    };

    deleteScene = async (id) => {
        await this.socket.delObject(id);
        if (this.state.selectedSceneId == id) {
            this.setState({selectedSceneId: null});
        }
        this.refreshData();
    }

    getFolderPrefix(sceneId) {
        let result = sceneId.split(".");
        result.shift();
        result.shift();
        result.pop();
        result = result.join(".");
        return result;
    }

    getFolderList = (folder) => {
        let result = [];
        result.push(folder)
        Object.values(folder.subfolders).forEach((subfolder) => {
            result = result.concat(this.getFolderList(subfolder));
        });

        return result;
    }

    render() {
        if (!this.state.ready) {
            return (<Loader theme={this.state.themeType}/>);
        }

        let component = this;


        return (
            <div className="App">
                <AppBar position="static">
                    <Tabs value={0}
                          onChange={(e, index) => this.selectTab(e.target.parentNode.dataset.name, index)}>
                        <Tab label={I18n.t('Scenes')} data-name="list"/>
                    </Tabs>
                </AppBar>
                <Container>
                <Grid container spacing={3}>
                    <Grid item xs={3}>
                    <div>
                    <Fab size="small" color="secondary" aria-label="Add" onClick={()=>{
                        this.createScene("folder.folder2.scene"+(Object.values(this.state.scenes).length+1));
                    }} title={I18n.t('Create new scene')}><IconAdd /></Fab>
                    <Fab size="small" color="secondary" aria-label="Add" onClick={()=>{
                        this.setState({addFolderDialog: this.state.folders, addFolderDialogTitle: ""});
                    }} title={I18n.t('Create new folder')}><IconFolderAdd /></Fab>
                    </div>
                    <Dialog open={this.state.addFolderDialog} onClose={()=>{this.setState({addFolderDialog: null})}}>
                        <DialogTitle>{I18n.t("Create folder")}</DialogTitle>
                        <TextField value={this.state.addFolderDialogTitle} onChange={(e)=>{this.setState({addFolderDialogTitle: e.target.value.replace(/[\][*,.;'"`<>\\?]/g, "")})}}/>
                        <Button onClick={()=>{component.addFolder(this.state.addFolderDialog, this.state.addFolderDialogTitle); this.setState({addFolderDialog: null});}} color="primary" autoFocus>
                            {I18n.t("Create")}
                        </Button>
                    </Dialog>
                    <Dialog open={this.state.editFolderDialog} onClose={()=>{this.setState({editFolderDialog: null})}}>
                        <DialogTitle>{I18n.t("Edit folder")}</DialogTitle>
                        <TextField value={this.state.editFolderDialogTitle} onChange={(e)=>{this.setState({editFolderDialogTitle: e.target.value.replace(/[\][*,.;'"`<>\\?]/g, "")})}}/>
                        <Button onClick={()=>{component.renameFolder(this.state.editFolderDialog, this.state.editFolderDialogTitle); this.setState({editFolderDialog: null});}} color="primary" autoFocus>
                            {I18n.t("edit")}
                        </Button>
                    </Dialog>
                    <div>
                        {this.renderTree(this.state.folders)}
                        { false && Object.values(this.state.scenes).map((scene) => {
                            return this.renderTreeScene(scene);
                        }) }
                    </div>
                    </Grid>
                    <Grid item xs={4}>
                    {component.state.selectedSceneId ?
                        <SceneForm 
                            key={component.state.selectedSceneId} 
                            deleteScene={this.deleteScene} 
                            cloneScene={this.cloneScene} 
                            updateScene={this.updateScene} 
                            scene={this.state.scenes[component.state.selectedSceneId]} 
                            socket={component.socket}
                            addSceneToFolderPrefix={component.addSceneToFolderPrefix}
                            folders={this.state.folders}
                            getFolder={this.getFolder}
                            getFolderList={this.getFolderList}
                            getFolderPrefix={this.getFolderPrefix}
                        />
                    : ""}
                    </Grid>
                    <Grid item xs={5}>
                        <div className="members-cell">
                            {component.state.selectedSceneId ?
                                <SceneMembersForm key={'selected' + component.state.selectedSceneId} updateScene={this.updateScene} scene={this.state.scenes[component.state.selectedSceneId]} socket={component.socket}/>
                            : ""}
                        </div>
                    </Grid>
                </Grid>
                </Container>
                {this.renderError()}
            </div>
        );
    }
}

export default withStyles(styles)(App);
